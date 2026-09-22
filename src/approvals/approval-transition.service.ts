import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/prisma.module';
import { err } from '../common/exceptions';
import { NotificationWriter } from '../notifications/notifications.controller';
import { AttendanceService } from '../attendance/attendance.service';
import { todayIso, dateRange } from '../common/time.util';

export type ApprovalRequestType = 'LEAVE' | 'REPLACEMENT_OFF';
export type Decision = 'approved' | 'rejected';

export interface ApprovalActor {
  id: number; // user id of decider
  name: string;
  role: string;
  // null = platform admin acting across companies
  companyId: number | null;
}

export interface TransitionResult {
  new_status: string;
  message_key: string;
}

@Injectable()
export class ApprovalTransitionService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly notifications: NotificationWriter,
    private readonly attendance: AttendanceService,
  ) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  /**
   * Port of ApprovalTransitionService::transition.
   * Level semantics (PHP): level 3 = direct supervisor, level 1 = HR final.
   * In NestJS: SUPERVISOR role → supervisor level; COMPANY_ADMIN/PLATFORM_ADMIN → HR level.
   */
  private levelOf(actor: ApprovalActor): 1 | 3 {
    return actor.role === 'SUPERVISOR' ? 3 : 1;
  }

  async transition(
    requestType: ApprovalRequestType,
    requestId: number,
    decision: Decision,
    actor: ApprovalActor,
    comment = '',
  ): Promise<TransitionResult> {
    const level = this.levelOf(actor);
    if (!requestId || requestId <= 0 || !actor.id || !actor.name) {
      throw err('LEAVE_INVALID_ACTOR', 403);
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      throw err('LEAVE_INVALID_TRANSITION', 400);
    }
    if (comment.length > 500 || (decision === 'rejected' && comment.length < 5)) {
      throw err('LEAVE_COMMENT_INVALID', 400);
    }

    const companyId = actor.companyId;

    // transaction with row lock semantics (Prisma interactive transaction)
    try {
      const outcome = await this.prisma.$transaction(
        async (tx) => {
          let row: any;
          let owner: any;

          if (requestType === 'LEAVE') {
            row = await tx.leaveRequest.findFirst({
              where: { id: requestId, deletedAt: null, ...(companyId == null ? {} : { companyId }) },
            });
            if (row) {
              owner = await tx.user.findFirst({ where: { id: row.userId } });
            }
          } else {
            row = await tx.replacementOff.findFirst({
              where: { id: requestId, deletedAt: null, ...(companyId == null ? {} : { companyId }) },
            });
            if (row) {
              owner = await tx.user.findFirst({ where: { id: row.userId } });
            }
          }

          if (!row || !owner) {
            return { error: 'NOT_FOUND' as const };
          }
          const cid = row.companyId;

          if (level === 3) {
            if (owner.id === actor.id) return { error: 'SELF_APPROVAL_DENIED' as const };
            if (owner.directLeadId !== actor.id) return { error: 'NOT_DIRECT_REPORT' as const };
          }

          const oldStatus = row.status;
          const allowedOld = level === 3 ? ['pending'] : ['pending', 'waiting_hr'];
          if (!allowedOld.includes(oldStatus)) {
            return { error: 'ALREADY_PROCESSED' as const };
          }

          let newStatus: string;
          if (level === 3) {
            newStatus = decision === 'approved' ? 'waiting_hr' : 'rejected';
          } else {
            newStatus = decision;
          }

          // CAS update
          let updated: any;
          if (requestType === 'LEAVE') {
            updated = await tx.leaveRequest.updateMany({
              where: { id: requestId, status: oldStatus as any, deletedAt: null },
              data: { status: newStatus as any },
            });
          } else {
            updated = await tx.replacementOff.updateMany({
              where: { id: requestId, status: oldStatus as any, deletedAt: null },
              data: { status: newStatus as any },
            });
          }
          if (updated.count !== 1) return { error: 'ALREADY_PROCESSED' as const };

          // audit row — companyId follows the request, not the actor
          await tx.requestApproval.create({
            data: {
              companyId: cid,
              requestType,
              requestId,
              eventType: 'APPROVAL',
              actorId: actor.id,
              level,
              status: newStatus,
              comment: comment || null,
              before: { status: oldStatus },
              after: { status: newStatus },
            },
          });

          // side effects only on final approved
          if (newStatus === 'approved') {
            if (requestType === 'LEAVE') {
              const leave = await tx.leaveRequest.findUniqueOrThrow({
                where: { id: requestId },
                include: { leaveType: true },
              });
              const startIso = todayIso(new Date(leave.startDate));
              const endIso = todayIso(new Date(leave.endDate));

              // presence rows for full-day
              const total = Number(leave.totalDays);
              if (total >= 1) {
                const presence = leave.leaveType.category === 'LEAVE' ? 'CUTI' : 'IZIN';
                for (const day of dateRange(startIso, endIso)) {
                  const exists = await tx.attendances.findFirst({
                    where: { companyId: cid, userId: leave.userId, tanggal: new Date(day) },
                  });
                  if (!exists) {
                    await tx.attendances.create({
                      data: {
                        companyId: cid,
                        userId: leave.userId,
                        tanggal: new Date(day),
                        checkIn: null,
                        checkOut: null,
                        statusMasuk: leave.leaveType.name,
                        statusPulang: null,
                        kehadiran: presence,
                        tipe: presence,
                        notes: leave.leaveType.name,
                      },
                    });
                  }
                }
              }

              // balance deduct
              if (leave.leaveType.isDeductible && total > 0) {
                const year = Number(startIso.slice(0, 4));
                const bal = await tx.leaveBalance.findFirst({
                  where: { companyId: cid, userId: leave.userId, leaveTypeId: leave.leaveTypeId, year },
                });
                if (!bal) return { error: 'SIDE_EFFECT_FAILED' as const };
                const updatedBal = await tx.leaveBalance.updateMany({
                  where: { id: bal.id, taken: bal.taken },
                  data: { taken: { increment: total } },
                });
                if (updatedBal.count !== 1) return { error: 'SIDE_EFFECT_FAILED' as const };
                // never touch `remaining` — generated column
              }
            }
            // replacement_off: no side effect (per PHP)
          }

          return { newStatus, userId: owner.id, requestType, requestId, companyId: cid };
        },
        { timeout: 15000 },
      );

      if ('error' in outcome && outcome.error) {
        this.mapError(outcome.error);
      }

      const newStatus = (outcome as any).newStatus as string;
      const userId = (outcome as any).userId as number;
      const cid = (outcome as any).companyId as number;

      // post-commit notifications
      const label =
        requestType === 'LEAVE' ? 'Cuti' : 'Replacement Off';
      const url = requestType === 'LEAVE' ? 'leaves' : 'replacement-off';
      const msg =
        newStatus === 'approved'
          ? 'disetujui'
          : newStatus === 'rejected'
            ? 'ditolak'
            : 'menunggu persetujuan HR';
      await this.notifications.notifyUser({
        companyId: cid,
        userId,
        category: requestType === 'LEAVE' ? 'LEAVE' : 'REPLACEMENT_OFF',
        eventKey: `${requestType.toLowerCase()}:status:${requestId}:${newStatus}:user:${userId}`,
        title: `Status ${label} Diperbarui`,
        body: `Pengajuan Anda ${msg}`,
        link: url,
      });
      if (newStatus === 'waiting_hr') {
        await this.notifications.notifyRoles({
          companyId: cid,
          roles: ['COMPANY_ADMIN', 'PLATFORM_ADMIN'],
          category: requestType === 'LEAVE' ? 'LEAVE' : 'REPLACEMENT_OFF',
          eventKeyBase: `${requestType.toLowerCase()}:status:${requestId}:${newStatus}`,
          title: 'Pengajuan Menunggu Persetujuan HR',
          body: `Pengajuan ${label} menunggu persetujuan HR`,
          link: url,
        });
      }

      const messageKey =
        newStatus === 'waiting_hr' ? 'LEAVE_FORWARDED_HR' : 'LEAVE_SUCCESS_MESSAGE';
      return { new_status: newStatus, message_key: messageKey };
    } catch (e: any) {
      if (e?.errorCode) throw e;
      if (String(e?.message).includes('UNIQUE')) throw err('ALREADY_PROCESSED_OR_CONFLICT' as any, 409);
      // eslint-disable-next-line no-console
      console.error(e);
      throw err('APPROVAL_SIDE_EFFECT_FAILED', 500);
    }
  }

  private mapError(code: string): never {
    switch (code) {
      case 'NOT_FOUND':
        throw err('NOT_FOUND', 404);
      case 'SELF_APPROVAL_DENIED':
      case 'NOT_DIRECT_REPORT':
        throw err('LEAVE_NOT_DIRECT_REPORT', 403);
      case 'ALREADY_PROCESSED':
        throw err('LEAVE_ALREADY_PROCESSED', 409);
      case 'SIDE_EFFECT_FAILED':
        throw err('APPROVAL_SIDE_EFFECT_FAILED', 500);
      default:
        throw err('SERVER_ERROR', 500);
    }
  }

  /** Supervisor pending list scoped to direct reports (recursive). */
  async pendingList(
    actor: ApprovalActor,
    params: { type?: string; view?: string; page?: number; length?: number; q?: string },
  ) {
    const c = this.c();
    const { UsersService } = await import('../users/users.service');
    // resolve subtree via raw query to avoid circular dep
    const subtree = await this.subtreeIds(actor.companyId, actor.id);
    const reportIds = subtree.filter((id) => id !== actor.id);
    const lim = Math.min(Math.max(params.length ?? 20, 1), 50);
    const page = Math.max(params.page ?? 1, 1);

    const whereLeave: any = {
      ...(actor.companyId == null ? {} : { companyId: actor.companyId }),
      userId: { in: reportIds },
      deletedAt: null,
    };
    const whereRo: any = {
      ...(actor.companyId == null ? {} : { companyId: actor.companyId }),
      userId: { in: reportIds },
      deletedAt: null,
    };

    if (params.view === 'history') {
      const audits = await c.requestApproval.findMany({
        where: {
          ...(actor.companyId == null ? {} : { companyId: actor.companyId }),
          actorId: actor.id,
          eventType: 'APPROVAL',
        },
        orderBy: { createdAt: 'desc' },
      });
      const leaveIds = audits.filter((a: any) => a.requestType === 'LEAVE').map((a: any) => a.requestId);
      const roIds = audits
        .filter((a: any) => a.requestType === 'REPLACEMENT_OFF')
        .map((a: any) => a.requestId);
      whereLeave.id = { in: leaveIds };
      whereRo.id = { in: roIds };
    } else {
      whereLeave.status = 'pending';
      whereRo.status = 'pending';
    }

    if (params.q) {
      // search by user name — filter post-query for simplicity on small pages
    }

    let records: any[] = [];
    if (!params.type || params.type === 'cuti' || params.type === 'izin') {
      const rows = await c.leaveRequest.findMany({
        where: whereLeave,
        include: { leaveType: true, user: { select: { id: true, namaLengkap: true } } },
        orderBy: { createdAt: 'desc' },
      });
      records.push(
        ...rows.map((r: any) => ({
          id: r.id,
          request_kind: 'LEAVE',
          type: r.leaveType.category === 'LEAVE' ? 'cuti' : 'izin',
          nama_lengkap: r.user.namaLengkap,
          user_id: r.userId,
          status: r.status,
          start_date: todayIso(new Date(r.startDate)),
          end_date: todayIso(new Date(r.endDate)),
          reason: r.reason,
          request_type: r.leaveType.name,
          detail_type: r.leaveType.code,
          day_type: r.isHalfDay ? 'Halfday' : 'Fullday',
          amount: Number(r.totalDays),
          has_attachment: !!r.attachment,
          attachment_url: r.attachment ? `/api/v1/leaves/${r.id}/attachment` : null,
          created_at: r.createdAt,
        })),
      );
    }
    if (!params.type || params.type === 'replacement_off') {
      const rows = await c.replacementOff.findMany({
        where: whereRo,
        include: { user: { select: { id: true, namaLengkap: true } } },
        orderBy: { createdAt: 'desc' },
      });
      records.push(
        ...rows.map((r: any) => ({
          id: r.id,
          request_kind: 'REPLACEMENT_OFF',
          type: 'replacement_off',
          nama_lengkap: r.user.namaLengkap,
          user_id: r.userId,
          status: r.status,
          start_date: r.originalDate ? todayIso(new Date(r.originalDate)) : null,
          end_date: r.replacementDate ? todayIso(new Date(r.replacementDate)) : null,
          reason: r.reason,
          request_type: 'Replacement Off',
          detail_type: null,
          day_type: r.isHalfDay ? 'Halfday' : 'Fullday',
          amount: null,
          expires_at: r.expiresAt ? todayIso(new Date(r.expiresAt)) : null,
          created_at: r.createdAt,
        })),
      );
    }

    if (params.q) {
      const q = params.q.toLowerCase();
      records = records.filter(
        (r) =>
          (r.nama_lengkap ?? '').toLowerCase().includes(q) ||
          (r.reason ?? '').toLowerCase().includes(q),
      );
    }

    records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const total = records.length;
    const totalPages = Math.max(1, Math.ceil(total / lim));
    const paged = records.slice((page - 1) * lim, page * lim);

    return {
      records: paged,
      pagination: {
        total_records: total,
        total_pages: totalPages,
        current_page: page,
        per_page: lim,
      },
    };
  }

  // null companyId (platform admin) walks direct reports across companies
  private async subtreeIds(companyId: number | null, rootId: number): Promise<number[]> {
    const c = this.c();
    const result = new Set<number>([rootId]);
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
        if (!result.has(ch.id)) {
          result.add(ch.id);
          frontier.push(ch.id);
        }
      }
    }
    return [...result];
  }
}
