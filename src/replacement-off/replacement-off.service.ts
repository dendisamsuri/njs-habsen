import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantPrismaService } from '../prisma/prisma.module';
import { err } from '../common/exceptions';
import { NotificationWriter } from '../notifications/notifications.controller';
import { todayIso, isValidIsoDate, addDaysIso } from '../common/time.util';

const DEFAULT_EXPIRY_DAYS = 30;
const STATUS_OK = new Set(['draft', 'pending', 'waiting_hr', 'approved', 'rejected', 'expired', 'cancelled', 'used']);

@Injectable()
export class ReplacementOffService {
  private readonly logger = new Logger(ReplacementOffService.name);

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly notifications: NotificationWriter,
  ) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  isExpired(ro: any): boolean {
    if (!ro.expiresAt) return false;
    const exp = todayIso(new Date(ro.expiresAt));
    const today = todayIso();
    return exp < today && (ro.status === 'draft' || ro.status === 'pending');
  }

  toRecord(r: any, schedule?: any): any {
    const sch = schedule ?? r.schedule;
    const originalDate = r.originalDate ? todayIso(new Date(r.originalDate)) : null;
    const replacementDate = r.replacementDate ? todayIso(new Date(r.replacementDate)) : null;
    const expiresAt = r.expiresAt ? todayIso(new Date(r.expiresAt)) : null;
    const expired = this.isExpired(r);
    return {
      id: r.id,
      original_date: originalDate,
      replacement_date: replacementDate,
      has_replacement_date: !!replacementDate,
      is_half_day: r.isHalfDay,
      off_type: r.isHalfDay ? 'Halfday' : 'Fullday',
      schedule_name: sch?.name ?? null,
      time_in: sch?.details?.[0]?.timeIn ?? null,
      time_out: sch?.details?.[0]?.timeOut ?? null,
      reason: r.reason,
      employee_note: r.employeeNote,
      status: r.status,
      status_label: this.statusLabel(r.status),
      expires_at: expiresAt,
      is_expired: expired,
      can_submit: r.status === 'draft' && !expired,
      created_at: r.createdAt,
    };
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'Menunggu Persetujuan';
      case 'waiting_hr':
        return 'Menunggu HR';
      case 'approved':
        return 'Disetujui';
      case 'rejected':
        return 'Ditolak';
      case 'expired':
        return 'Kadaluarsa';
      case 'used':
        return 'Digunakan';
      default:
        return 'Draft';
    }
  }

  async list(user: any, status?: string) {
    if (status && !STATUS_OK.has(status)) throw err('INVALID_ENUM', 400);
    if (user.allowReplacementOff !== true) throw err('REPLACEMENT_NOT_ALLOWED', 403);
    const c = this.c();
    const rows = await c.replacementOff.findMany({
      where: { companyId: user.companyId, userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { schedule: { include: { details: true } } },
    });
    let records = rows.map((r: any) => this.toRecord(r));
    if (status) records = records.filter((r: any) => r.status === status);
    return { total: records.length, records };
  }

  async adminListCompany(companyId: number, status?: string, supervisorUserId?: number | null) {
    if (status && !STATUS_OK.has(status)) throw err('INVALID_ENUM', 400);
    const c = this.c();
    const where: any = { companyId, deletedAt: null };
    if (status) where.status = status as any;
    if (supervisorUserId) {
      const { UsersService } = await import('../users/users.service');
      // inline subtree resolve (avoid DI)
      const ids = new Set<number>([supervisorUserId]);
      let frontier = [supervisorUserId];
      for (let d = 0; d < 10 && frontier.length; d++) {
        const children: any[] = await c.user.findMany({
          where: { companyId, directLeadId: { in: frontier }, deletedAt: null },
          select: { id: true },
        });
        frontier = [];
        for (const ch of children) {
          if (!ids.has(ch.id)) {
            ids.add(ch.id);
            frontier.push(ch.id);
          }
        }
      }
      where.userId = { in: [...ids] };
    }
    const rows = await c.replacementOff.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        schedule: { include: { details: true } },
        user: { select: { id: true, namaLengkap: true } },
      },
    });
    const records = rows.map((r: any) => ({
      ...this.toRecord(r),
      user_id: r.userId,
      nama_lengkap: r.user?.namaLengkap ?? null,
    }));
    return { total: records.length, records };
  }

  async submit(user: any, id: number, replacementDate: string, note?: string) {
    if (user.allowReplacementOff !== true) throw err('REPLACEMENT_NOT_ALLOWED', 403);
    if (!isValidIsoDate(replacementDate)) throw err('REPLACEMENT_INVALID_DATE', 400);
    if (note && note.length > 500) throw err('VALIDATION_ERROR', 400);

    const c = this.c();
    const row = await c.replacementOff.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: { schedule: { include: { details: true } } },
    });
    if (!row) throw err('REPLACEMENT_NOT_FOUND', 404);
    if (row.status !== 'draft') throw err('LEAVE_ALREADY_PROCESSED', 409);
    if (this.isExpired(row)) throw err('REPLACEMENT_EXPIRED', 409);

    const originalDate = todayIso(new Date(row.originalDate));
    if (replacementDate === originalDate) throw err('REPLACEMENT_INVALID_DATE', 400);

    // overlap rules
    const conflicts = await c.replacementOff.findMany({
      where: {
        companyId: user.companyId,
        userId: user.id,
        id: { not: id },
        deletedAt: null,
        replacementDate: new Date(replacementDate),
        status: { notIn: ['rejected', 'expired'] as any },
      },
    });
    if (conflicts.some((x: any) => !x.isHalfDay)) {
      throw err('CONFLICT', 409);
    }
    if (!row.isHalfDay && conflicts.some((x: any) => x.isHalfDay)) {
      // full-day replacement needs empty day; 1 half-day still blocks full day? PHP: full-day conflict always
      throw err('CONFLICT', 409);
    }
    if (row.isHalfDay && conflicts.filter((x: any) => x.isHalfDay).length >= 2) {
      throw err('CONFLICT', 409);
    }
    if (row.isHalfDay && conflicts.some((x: any) => !x.isHalfDay)) {
      throw err('CONFLICT', 409);
    }

    const updated = await c.replacementOff.update({
      where: { id },
      data: { replacementDate: new Date(replacementDate), employeeNote: note ?? null, status: 'pending' },
      include: { schedule: { include: { details: true } } },
    });

    await c.requestApproval.create({
      data: {
        companyId: user.companyId,
        requestType: 'REPLACEMENT_OFF',
        requestId: id,
        eventType: 'SUBMIT',
        actorId: user.id,
        level: 0,
        status: 'pending',
      },
    });

    await this.notifications.notifyDirectLead({
      companyId: user.companyId,
      userId: user.id,
      category: 'REPLACEMENT_OFF',
      eventKey: `replacement_off:submitted:${id}`,
      title: 'Pengajuan Replacement Off Baru',
      body: `${user.namaLengkap} mengajukan replacement off`,
      link: 'replacement-off',
    });

    return this.toRecord(updated);
  }

  async adminCreate(
    companyId: number,
    input: {
      user_id: number;
      original_date: string;
      reason?: string;
      is_half_day?: boolean;
      expiry_days?: number;
      schedule_id?: number;
    },
  ) {
    if (!isValidIsoDate(input.original_date)) throw err('INVALID_DATE_FORMAT', 400);
    const c = this.c();
    const user = await c.user.findFirst({
      where: { id: input.user_id, companyId, deletedAt: null },
      include: { schedule: true },
    });
    if (!user) throw err('USER_NOT_FOUND', 404);
    const scheduleId = input.schedule_id ?? user.scheduleId;
    if (!scheduleId) throw err('SCHEDULE_NOT_FOUND', 400);
    const conflict = await c.replacementOff.findFirst({
      where: {
        companyId,
        userId: user.id,
        originalDate: new Date(input.original_date),
        deletedAt: null,
        status: { notIn: ['rejected', 'expired'] as any },
      },
    });
    if (conflict) throw err('CONFLICT', 409);

    const expiryDays = input.expiry_days ?? DEFAULT_EXPIRY_DAYS;
    const expiresAt = addDaysIso(input.original_date, expiryDays);
    const row = await c.replacementOff.create({
      data: {
        companyId,
        userId: user.id,
        scheduleId,
        originalDate: new Date(input.original_date),
        isHalfDay: input.is_half_day ?? false,
        expiresAt: new Date(expiresAt),
        reason: input.reason ?? null,
        status: 'draft',
        createdById: null,
      },
      include: { schedule: { include: { details: true } } },
    });
    return this.toRecord(row);
  }

  /** Port of cron_expire_replacement / ReplacementOffModel::expireOverdue */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireOverdue(): Promise<number> {
    try {
      const today = new Date();
      const result = await this.prisma.replacementOff.updateMany({
        where: {
          status: { in: ['draft', 'pending'] },
          expiresAt: { lt: today },
          deletedAt: null,
        },
        data: { status: 'expired' },
      });
      this.logger.log(`Expired ${result.count} replacement off entries`);
      return result.count;
    } catch (e) {
      this.logger.error(`Expire failed: ${String(e)}`);
      return 0;
    }
  }
}
