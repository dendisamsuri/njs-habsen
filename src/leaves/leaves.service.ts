import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/prisma.module';
import { err } from '../common/exceptions';
import { NotificationWriter } from '../notifications/notifications.controller';
import {
  todayIso,
  isValidIsoDate,
} from '../common/time.util';

export interface LeaveCreateInput {
  leave_type_id: number;
  start_date: string;
  end_date?: string;
  reason: string;
  is_half_day?: boolean;
  attachment?: string;
}

const STATUS_OK = new Set(['pending', 'waiting_hr', 'approved', 'rejected', 'cancelled']);

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly notifications: NotificationWriter,
  ) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  toRecord(r: any, leaveType?: any): any {
    const lt = leaveType ?? r.leaveType;
    const startIso = todayIso(new Date(r.startDate));
    const endIso = todayIso(new Date(r.endDate));
    return {
      id: r.id,
      leave_type_id: r.leaveTypeId,
      jenis: lt?.name ?? null,
      leave_type_name: lt?.name ?? null,
      category: lt?.category ?? null,
      start_date: startIso,
      end_date: endIso,
      total_days: Number(r.totalDays),
      is_half_day: r.isHalfDay,
      reason: r.reason,
      status: r.status,
      status_label: this.statusLabel(r.status),
      has_attachment: !!r.attachment,
      attachment_url: r.attachment ? `/api/v1/leaves/${r.id}/attachment` : null,
      attachment: r.attachment,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    };
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'approved':
        return 'Disetujui';
      case 'rejected':
        return 'Ditolak';
      case 'cancelled':
        return 'Dibatalkan';
      case 'waiting_hr':
        return 'Menunggu HR';
      default:
        return 'Pending';
    }
  }

  async balance(user: any) {
    const companyId = user.companyId!;
    const year = new Date().getFullYear();
    const c = this.c();
    const types = await c.leaveType.findMany({
      where: { companyId, isActive: true, code: { not: 'JOINT' } },
      include: {
        leaveBalances: {
          where: { companyId, userId: user.id, year },
        },
      },
      orderBy: { name: 'asc' },
    });
    let totalEntitlement = 0;
    let totalTaken = 0;
    let totalRemaining = 0;
    const list = types.map((t: any) => {
      const bal = t.leaveBalances?.[0];
      const entitlement = bal ? Number(bal.entitlement) : 0;
      const taken = bal ? Number(bal.taken) : 0;
      const remaining = bal && bal.remaining !== null ? Number(bal.remaining) : entitlement - taken;
      const hasBalance = !!bal;
      totalEntitlement += entitlement;
      totalTaken += taken;
      totalRemaining += remaining;
      return {
        leave_type_id: t.id,
        name: t.name,
        code: t.code,
        category: t.category,
        is_deductible: t.isDeductible,
        requires_attachment: t.requiresAttachment,
        entitlement,
        taken,
        remaining,
        has_balance: hasBalance,
      };
    });
    return {
      year,
      total_entitlement: totalEntitlement,
      total_taken: totalTaken,
      total_remaining: totalRemaining,
      allow_half_day: user.allowHalfDay ?? true,
      types: list,
    };
  }

  async list(
    user: any,
    params: { limit?: number; offset?: number; status?: string },
  ) {
    if (params.status && !STATUS_OK.has(params.status)) {
      throw err('INVALID_ENUM', 400);
    }
    const companyId = user.companyId!;
    const lim = Math.min(Math.max(Number(params.limit ?? 20), 1), 100);
    const off = Math.max(Number(params.offset ?? 0), 0);
    const c = this.c();
    const where: any = { companyId, userId: user.id, deletedAt: null };
    if (params.status) where.status = params.status as any;
    const [total, rows] = await Promise.all([
      c.leaveRequest.count({ where }),
      c.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: lim,
        skip: off,
        include: { leaveType: true },
      }),
    ]);
    return {
      limit: lim,
      offset: off,
      total,
      records: rows.map((r: any) => this.toRecord(r)),
    };
  }

  async detail(user: any, id: number) {
    const c = this.c();
    const row = await c.leaveRequest.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: { leaveType: true },
    });
    if (!row) throw err('LEAVE_NOT_FOUND', 404);
    const approvals = await c.requestApproval.findMany({
      where: { requestType: 'LEAVE', requestId: id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { namaLengkap: true } } },
    });
    return {
      ...this.toRecord(row),
      timeline: approvals.map((a: any) => ({
        event_type: a.eventType,
        label: a.eventType,
        status: a.status,
        actor_name: a.actor?.namaLengkap ?? null,
        comment: a.comment,
        timestamp: a.createdAt,
        level: a.level,
      })),
    };
  }

  private async validateAndCompute(user: any, companyId: number, input: LeaveCreateInput, existingId?: number, existingAttachment?: string | null) {
    const c = this.c();
    const leaveType = await c.leaveType.findFirst({
      where: { id: input.leave_type_id, companyId, isActive: true },
    });
    if (!leaveType) throw err('LEAVE_TYPE_NOT_FOUND', 400);
    if (leaveType.code === 'JOINT' && user.role === 'EMPLOYEE') {
      throw err('VALIDATION_ERROR', 400);
    }
    if (!isValidIsoDate(input.start_date)) throw err('INVALID_DATE_FORMAT', 400);
    const start = input.start_date;
    let end = input.end_date ?? input.start_date;
    if (!isValidIsoDate(end)) throw err('INVALID_DATE_FORMAT', 400);

    if (input.is_half_day) {
      if (user.allowHalfDay === false) throw err('VALIDATION_ERROR', 400);
      end = start;
    } else if (end < start) {
      throw err('LEAVE_INVALID_DATES', 400);
    }

    let totalDays: number;
    if (input.is_half_day) {
      totalDays = 0.5;
    } else {
      const [y1, m1, d1] = start.split('-').map(Number);
      const [y2, m2, d2] = end.split('-').map(Number);
      const diff = Math.round(
        (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000,
      );
      totalDays = diff + 1;
    }

    const hasAttachment = Boolean(input.attachment || existingAttachment);
    if (leaveType.requiresAttachment && !hasAttachment) {
      throw err('LEAVE_ATTACHMENT_REQUIRED', 400);
    }

    // overlap
    const overlap = await c.leaveRequest.findFirst({
      where: {
        companyId,
        userId: user.id,
        deletedAt: null,
        status: { in: ['pending', 'waiting_hr', 'approved'] as any },
        startDate: { lte: new Date(end) },
        endDate: { gte: new Date(start) },
        ...(existingId ? { id: { not: existingId } } : {}),
      },
    });
    if (overlap) throw err('CONFLICT', 409);

    // balance check for deductible types at create time (soft guard; deduct on approve)
    if (leaveType.isDeductible && totalDays > 0) {
      const year = Number(start.slice(0, 4));
      const bal = await c.leaveBalance.findFirst({
        where: { companyId, userId: user.id, leaveTypeId: leaveType.id, year },
      });
      if (bal) {
        const remaining =
          bal.remaining !== null ? Number(bal.remaining) : Number(bal.entitlement) - Number(bal.taken);
        if (remaining < totalDays) throw err('LEAVE_BALANCE_INSUFFICIENT', 400);
      }
    }

    return { leaveType, start, end, totalDays };
  }

  private async saveAttachment(companyId: number, userId: number, dataUri: string): Promise<string> {
    // Attachments live under uploads/cuti — never uploads/absen.
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const { randomBytes } = await import('crypto');
    const DATA_URI_RE = /^data:image\/(jpeg|jpg|png);base64,/;
    if (!DATA_URI_RE.test(dataUri)) throw err('LEAVE_ATTACHMENT_INVALID', 400);
    const b64 = dataUri.slice(dataUri.indexOf(',') + 1).replace(/ /g, '+');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 512 || buf.length > 2 * 1024 * 1024) throw err('LEAVE_ATTACHMENT_INVALID', 400);
    const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng =
      buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (!isJpeg && !isPng) throw err('LEAVE_ATTACHMENT_INVALID', 400);
    const dir = path.join(process.env.UPLOAD_DIR ?? 'uploads', 'cuti');
    await fs.mkdir(dir, { recursive: true });
    const name = `cuti_${userId}_${Date.now()}_${randomBytes(4).toString('hex')}.jpg`;
    await fs.writeFile(path.join(dir, name), buf);
    return `cuti/${name}`;
  }

  async create(user: any, input: LeaveCreateInput) {
    const companyId = user.companyId!;
    const c = this.c();
    const { leaveType, start, end, totalDays } = await this.validateAndCompute(
      user,
      companyId,
      input,
    );
    let attachmentPath: string | null = null;
    if (input.attachment) {
      attachmentPath = await this.saveAttachment(companyId, user.id, input.attachment);
    }
    try {
      const row = await c.leaveRequest.create({
        data: {
          companyId,
          userId: user.id,
          leaveTypeId: leaveType.id,
          startDate: new Date(start),
          endDate: new Date(end),
          totalDays,
          isHalfDay: !!input.is_half_day,
          reason: input.reason,
          attachment: attachmentPath,
          status: 'pending',
        },
        include: { leaveType: true },
      });
      await c.requestApproval.create({
        data: {
          companyId,
          requestType: 'LEAVE',
          requestId: row.id,
          eventType: 'SUBMIT',
          actorId: user.id,
          level: 0,
          status: 'pending',
        },
      });
      await this.notifications.notifyDirectLead({
        companyId,
        userId: user.id,
        category: 'LEAVE',
        eventKey: `leave:submitted:${row.id}`,
        titleKey: 'NOTIF_LEAVE_SUBMITTED_TITLE',
        bodyKey: 'NOTIF_LEAVE_SUBMITTED_LEAD_BODY',
        params: { name: user.namaLengkap },
        link: 'leaves',
      });
      await this.notifications.notifyRoles({
        companyId,
        roles: ['COMPANY_ADMIN', 'PLATFORM_ADMIN'],
        category: 'LEAVE',
        eventKeyBase: `leave:submitted:${row.id}`,
        titleKey: 'NOTIF_LEAVE_SUBMITTED_TITLE',
        bodyKey: 'NOTIF_LEAVE_SUBMITTED_ROLE_BODY',
        params: { name: user.namaLengkap },
        link: 'leaves',
      });
      return this.toRecord(row);
    } catch (e) {
      if (attachmentPath) {
        try {
          const { promises: fs } = await import('fs');
          const path = await import('path');
          await fs.unlink(path.join(process.env.UPLOAD_DIR ?? 'uploads', attachmentPath));
        } catch {
          // ignore
        }
      }
      if ((e as any)?.code === 'P2002') throw err('DUPLICATE', 409);
      if ((e as any)?.errorCode) throw e;
      throw err('LEAVE_SAVE_FAILED', 500);
    }
  }

  async update(user: any, id: number, input: LeaveCreateInput) {
    const companyId = user.companyId!;
    const c = this.c();
    const row = await c.leaveRequest.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: { leaveType: true },
    });
    if (!row) throw err('LEAVE_NOT_FOUND', 404);
    if (row.status !== 'pending') throw err('LEAVE_ALREADY_PROCESSED', 409);
    const { leaveType, start, end, totalDays } = await this.validateAndCompute(
      user,
      companyId,
      input,
      id,
      row.attachment,
    );
    let attachmentPath = row.attachment;
    if (input.attachment) {
      attachmentPath = await this.saveAttachment(companyId, user.id, input.attachment);
      if (row.attachment && row.attachment !== attachmentPath) {
        try {
          const { promises: fs } = await import('fs');
          const path = await import('path');
          await fs.unlink(path.join(process.env.UPLOAD_DIR ?? 'uploads', row.attachment));
        } catch {
          // ignore
        }
      }
    }
    if (!attachmentPath && leaveType.requiresAttachment) {
      throw err('LEAVE_ATTACHMENT_REQUIRED', 400);
    }
    const updated = await c.leaveRequest.update({
      where: { id },
      data: {
        leaveTypeId: leaveType.id,
        startDate: new Date(start),
        endDate: new Date(end),
        totalDays,
        isHalfDay: !!input.is_half_day,
        reason: input.reason,
        attachment: attachmentPath,
      },
      include: { leaveType: true },
    });
    return this.toRecord(updated);
  }

  async cancel(user: any, id: number, reason: string) {
    if (!reason || reason.length < 5 || reason.length > 500) {
      throw err('LEAVE_COMMENT_INVALID', 400);
    }
    const c = this.c();
    const row = await c.leaveRequest.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!row) throw err('LEAVE_NOT_FOUND', 404);
    if (row.status !== 'pending') throw err('LEAVE_ALREADY_PROCESSED', 409);
    await c.leaveRequest.update({ where: { id }, data: { status: 'cancelled' } });
    await c.requestApproval.create({
      data: {
        companyId: row.companyId,
        requestType: 'LEAVE',
        requestId: id,
        eventType: 'DELETE',
        actorId: user.id,
        level: 0,
        status: 'cancelled',
        comment: reason,
      },
    });
    if (row.attachment) {
      try {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        await fs.unlink(path.join(process.env.UPLOAD_DIR ?? 'uploads', row.attachment));
      } catch {
        // ignore
      }
    }
    return true;
  }

  private async isInSubtree(
    companyId: number | null,
    rootId: number,
    targetId: number,
  ): Promise<boolean> {
    if (targetId === rootId) return false;
    const c = this.c();
    let frontier = [rootId];
    for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
      const children: any[] = await c.user.findMany({
        where: {
          ...(companyId == null ? {} : { companyId }),
          directLeadId: { in: frontier },
          deletedAt: null,
        },
        select: { id: true },
      });
      frontier = [];
      for (const ch of children) {
        if (ch.id === targetId) return true;
        frontier.push(ch.id);
      }
    }
    return false;
  }

  async attachment(user: any, id: number): Promise<string> {
    const c = this.c();
    const row = await c.leaveRequest.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw err('LEAVE_NOT_FOUND', 404);
    if (row.userId !== user.id) {
      if (user.role === 'SUPERVISOR') {
        const allowed = await this.isInSubtree(user.companyId ?? null, user.id, row.userId);
        if (!allowed) throw err('LEAVE_NOT_DIRECT_REPORT', 403);
      } else if (user.role !== 'COMPANY_ADMIN' && user.role !== 'PLATFORM_ADMIN') {
        throw err('LEAVE_NOT_FOUND', 404);
      }
    }
    const stored = String(row?.attachment ?? '').trim();
    if (!stored) throw err('NOT_FOUND', 404);
    // Legacy rows vary: `cuti/name` (current), bare basename (PHP era),
    // or bare absen basename (pre-fix saveAttachment fallback miss).
    // Resolve against known dirs; never trust stored dirs outside them.
    const parts = stored.split(/[\\/]/).filter(Boolean);
    const file = parts.pop() ?? '';
    if (!file || file === '.' || file === '..') throw err('NOT_FOUND', 404);
    const ordered = <string[]>[];
    if (parts.length === 1 && (parts[0] === 'cuti' || parts[0] === 'absen')) {
      ordered.push(`${parts[0]}/${file}`);
    }
    ordered.push(`cuti/${file}`, `absen/${file}`, file);
    const { existsSync } = await import('fs');
    const path = await import('path');
    const base = process.env.UPLOAD_DIR ?? 'uploads';
    for (const rel of new Set(ordered)) {
      if (existsSync(path.join(base, rel))) return rel;
    }
    throw err('NOT_FOUND', 404);
  }

  async softDelete(companyId: number, id: number, actorId: number, reason: string) {
    const c = this.c();
    const row = await c.leaveRequest.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw err('LEAVE_NOT_FOUND', 404);
    await c.leaveRequest.update({ where: { id }, data: { deletedAt: new Date() } });
    await c.requestApproval.create({
      data: {
        companyId,
        requestType: 'LEAVE',
        requestId: id,
        eventType: 'DELETE',
        actorId,
        level: 0,
        status: 'deleted',
        comment: reason,
        before: row as any,
      },
    });
    return true;
  }
}
