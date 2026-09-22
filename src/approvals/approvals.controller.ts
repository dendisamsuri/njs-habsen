import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApprovalTransitionService, ApprovalActor } from './approval-transition.service';
import { Roles } from '../common/roles.guard';
import { err } from '../common/exceptions';
import { TenantPrismaService } from '../prisma/prisma.module';

class DecideDto {
  @IsIn(['LEAVE', 'REPLACEMENT_OFF', 'cuti', 'izin', 'replacement_off'] as any)
  type!: string;
  @IsInt() id!: number;
  @IsIn(['approved', 'rejected']) decision!: 'approved' | 'rejected';
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

function mapType(t: string): 'LEAVE' | 'REPLACEMENT_OFF' {
  if (t === 'REPLACEMENT_OFF' || t === 'replacement_off') return 'REPLACEMENT_OFF';
  return 'LEAVE';
}

@Controller('approvals')
@Roles('SUPERVISOR', 'COMPANY_ADMIN', 'PLATFORM_ADMIN')
export class ApprovalsController {
  constructor(
    private readonly transitions: ApprovalTransitionService,
    private readonly prisma: TenantPrismaService,
  ) {}

  private actor(req: any): ApprovalActor {
    return {
      id: req.user.id,
      name: req.user.namaLengkap ?? req.user.email,
      role: req.user.role,
      companyId: req.user.companyId,
    };
  }

  @Get('capabilities')
  async capabilities(@Req() req: any) {
    if (req.user.role !== 'SUPERVISOR') {
      return { is_supervisor: false, counts: { cuti: 0, izin: 0, replacement_off: 0, total: 0 } };
    }
    const c = (this.prisma as any).scoped();
    const subtree = await (this.transitions as any).subtreeIds(req.user.companyId, req.user.id);
    const reportIds = subtree.filter((id: number) => id !== req.user.id);
    const [cuti, izin, replacement] = await Promise.all([
      c.leaveRequest.count({
        where: {
          companyId: req.user.companyId,
          userId: { in: reportIds },
          status: 'pending',
          deletedAt: null,
          leaveType: { category: 'LEAVE' },
        },
      }),
      c.leaveRequest.count({
        where: {
          companyId: req.user.companyId,
          userId: { in: reportIds },
          status: 'pending',
          deletedAt: null,
          leaveType: { category: { in: ['PERMIT', 'SICK'] } },
        },
      }),
      c.replacementOff.count({
        where: {
          companyId: req.user.companyId,
          userId: { in: reportIds },
          status: 'pending',
          deletedAt: null,
        },
      }),
    ]);
    return {
      is_supervisor: true,
      counts: { cuti, izin, replacement_off: replacement, total: cuti + izin + replacement },
    };
  }

  @Get('listing')
  listing(
    @Req() req: any,
    @Query('type') type?: string,
    @Query('view') view?: string,
    @Query('page') page?: string,
    @Query('length') length?: string,
    @Query('q') q?: string,
  ) {
    if (view && view !== 'pending' && view !== 'history') throw err('VALIDATION_ERROR', 400);
    return this.transitions.pendingList(this.actor(req), {
      type,
      view: view ?? 'pending',
      page: page ? Number(page) : 1,
      length: length ? Number(length) : 20,
      q,
    });
  }

  @Get('pending')
  pending(@Req() req: any, @Query('type') type?: string) {
    return this.transitions.pendingList(this.actor(req), {
      type,
      view: 'pending',
      length: 50,
    });
  }

  @Get('detail/:type/:id')
  async detail(
    @Req() req: any,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const kind = mapType(type);
    const c = (this.prisma as any).scoped();
    if (kind === 'LEAVE') {
      const row = await c.leaveRequest.findFirst({
        where: { id, deletedAt: null, ...(req.user.companyId == null ? {} : { companyId: req.user.companyId }) },
        include: { leaveType: true, user: { select: { id: true, namaLengkap: true } } },
      });
      if (!row) throw err('NOT_FOUND', 404);
      // scope: supervisor only direct reports
      if (req.user.role === 'SUPERVISOR') {
        const subtree = await (this.transitions as any).subtreeIds(req.user.companyId, req.user.id);
        if (!subtree.includes(row.userId) || row.userId === req.user.id) {
          throw err('LEAVE_NOT_DIRECT_REPORT', 403);
        }
      }
      return {
        id: row.id,
        user_id: row.userId,
        nama_lengkap: row.user.namaLengkap,
        status: row.status,
        start_date: todayIsoSafe(row.startDate),
        end_date: todayIsoSafe(row.endDate),
        reason: row.reason,
        total_days: Number(row.totalDays),
        is_half_day: row.isHalfDay,
        request_type: row.leaveType.name,
        has_attachment: !!row.attachment,
        attachment_url: row.attachment ? `/api/v1/leaves/${row.id}/attachment` : null,
      };
    }
    const row = await c.replacementOff.findFirst({
      where: { id, deletedAt: null, ...(req.user.companyId == null ? {} : { companyId: req.user.companyId }) },
      include: { user: { select: { id: true, namaLengkap: true } } },
    });
    if (!row) throw err('NOT_FOUND', 404);
    if (req.user.role === 'SUPERVISOR') {
      const subtree = await (this.transitions as any).subtreeIds(req.user.companyId, req.user.id);
      if (!subtree.includes(row.userId) || row.userId === req.user.id) {
        throw err('LEAVE_NOT_DIRECT_REPORT', 403);
      }
    }
    return {
      id: row.id,
      user_id: row.userId,
      nama_lengkap: row.user.namaLengkap,
      status: row.status,
      original_date: row.originalDate ? todayIsoSafe(row.originalDate) : null,
      replacement_date: row.replacementDate ? todayIsoSafe(row.replacementDate) : null,
      reason: row.reason,
      is_half_day: row.isHalfDay,
      request_type: 'Replacement Off',
      expires_at: row.expiresAt ? todayIsoSafe(row.expiresAt) : null,
    };
  }

  @Post('decide')
  @HttpCode(200)
  async decide(@Req() req: any, @Body() dto: DecideDto) {
    const result = await this.transitions.transition(
      mapType(dto.type),
      dto.id,
      dto.decision,
      this.actor(req),
      dto.comment ?? '',
    );
    return { new_status: result.new_status, message_key: result.message_key };
  }
}

function todayIsoSafe(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
