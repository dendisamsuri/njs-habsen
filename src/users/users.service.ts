import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TenantPrismaService } from '../prisma/prisma.module';
import { err } from '../common/exceptions';
import { assertEmployeeRefs } from '../common/employee-refs';

export interface CreateUserInput {
  email: string;
  password?: string;
  nama_lengkap: string;
  nip?: string;
  role?: string;
  direct_lead_id?: number | null;
  position_id?: number | null;
  location_id?: number | null;
  schedule_id?: number | null;
  phone?: string;
  is_flexible_location?: boolean;
  allow_replacement_off?: boolean;
  allow_schedule_selection?: boolean;
  allow_multiple_checkout?: boolean;
  allow_half_day?: boolean;
  allow_joint_leave?: boolean;
  lang_pref?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private client() {
    return (this.prisma as any).scoped();
  }

  async list(params: { companyId: number; limit?: number; offset?: number; search?: string; role?: string }) {
    const c = this.client();
    const where: any = { companyId: params.companyId, deletedAt: null };
    if (params.search) {
      where.OR = [
        { namaLengkap: { contains: params.search } },
        { email: { contains: params.search } },
        { nip: { contains: params.search } },
      ];
    }
    if (params.role) where.role = params.role as any;
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);
    const [total, rows] = await Promise.all([
      c.user.count({ where }),
      c.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { id: 'desc' },
        include: { position: true, location: true, directLead: { select: { id: true, namaLengkap: true } } },
      }),
    ]);
    return {
      limit,
      offset,
      total,
      records: rows.map((u: any) => this.toRecord(u)),
    };
  }

  toRecord(u: any) {
    return {
      id: u.id,
      user_id: u.id,
      email: u.email,
      nama_lengkap: u.namaLengkap,
      nip: u.nip,
      role: u.role,
      direct_lead_id: u.directLeadId,
      direct_lead_name: u.directLead?.namaLengkap ?? null,
      position_id: u.positionId,
      posisi_id: u.positionId,
      posisi_nama: u.position?.name ?? null,
      location_id: u.locationId,
      lokasi_id: u.locationId,
      lokasi_nama: u.location?.name ?? null,
      schedule_id: u.scheduleId,
      phone: u.phone,
      telp: u.phone,
      is_active: u.isActive,
      face_registered: u.faceRegistered,
      is_flexible_location: u.isFlexibleLocation ? 'Y' : 'N',
      allow_replacement_off: u.allowReplacementOff,
      allow_schedule_selection: u.allowScheduleSelection ? 'Y' : 'N',
      allow_multiple_checkout: u.allowMultipleCheckout ? 'Y' : 'N',
      allow_half_day: u.allowHalfDay,
      allow_joint_leave: u.allowJointLeave,
      lang_pref: u.langPref,
      created_at: u.createdAt,
      deleted_at: u.deletedAt,
    };
  }

  async create(companyId: number, input: CreateUserInput) {
    const c = this.client();
    const email = input.email.toLowerCase().trim();
    // email unique globally — lookup must stay unscoped
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) throw err('EMAIL_TAKEN', 409);
    const nip = input.nip ? input.nip.trim() : null;
    if (nip) {
      const dupNip = await this.prisma.user.findFirst({ where: { companyId, nip } });
      if (dupNip) throw err('NIP_TAKEN', 409);
    }
    const phone = input.phone ? input.phone.trim() : null;
    if (phone) {
      const dupPhone = await this.prisma.user.findFirst({ where: { companyId, phone } });
      if (dupPhone) throw err('PHONE_TAKEN', 409);
    }
    if (!input.password || input.password.length < 8) throw err('INVALID_PASSWORD', 400);
    await assertEmployeeRefs(c, companyId, input);
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await c.user.create({
      data: {
        companyId,
        email,
        passwordHash,
        namaLengkap: input.nama_lengkap,
        nip,
        role: (input.role as any) ?? 'EMPLOYEE',
        directLeadId: input.direct_lead_id ?? null,
        positionId: input.position_id ?? null,
        locationId: input.location_id ?? null,
        scheduleId: input.schedule_id ?? null,
        phone,
        isFlexibleLocation: input.is_flexible_location ?? false,
        allowReplacementOff: input.allow_replacement_off ?? true,
        allowScheduleSelection: input.allow_schedule_selection ?? false,
        allowMultipleCheckout: input.allow_multiple_checkout ?? false,
        allowHalfDay: input.allow_half_day ?? true,
        allowJointLeave: input.allow_joint_leave ?? true,
        langPref: input.lang_pref ?? 'id',
      },
      include: { position: true, location: true },
    });
    return this.toRecord(user);
  }

  async update(companyId: number, id: number, input: Partial<CreateUserInput> & { is_active?: boolean; password?: string }) {
    const c = this.client();
    const user = await c.user.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!user) throw err('USER_NOT_FOUND', 404);
    if (input.email && input.email.toLowerCase().trim() !== user.email) {
      const dup = await this.prisma.user.findFirst({ where: { email: input.email.toLowerCase().trim() } });
      if (dup) throw err('EMAIL_TAKEN', 409);
    }
    const nextNip = input.nip !== undefined ? (input.nip ? input.nip.trim() : null) : undefined;
    if (nextNip !== undefined && nextNip !== user.nip && nextNip !== null) {
      const dupNip = await this.prisma.user.findFirst({ where: { companyId, nip: nextNip, NOT: { id } } });
      if (dupNip) throw err('NIP_TAKEN', 409);
    }
    const nextPhone = input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : undefined;
    if (nextPhone !== undefined && nextPhone !== user.phone && nextPhone !== null) {
      const dupPhone = await this.prisma.user.findFirst({ where: { companyId, phone: nextPhone, NOT: { id } } });
      if (dupPhone) throw err('PHONE_TAKEN', 409);
    }
    await assertEmployeeRefs(c, companyId, input);
    const data: any = {};
    if (input.email) data.email = input.email.toLowerCase().trim();
    if (input.nama_lengkap) data.namaLengkap = input.nama_lengkap;
    if (input.nip !== undefined) data.nip = nextNip;
    if (input.role) data.role = input.role as any;
    if (input.direct_lead_id !== undefined) data.directLeadId = input.direct_lead_id;
    if (input.position_id !== undefined) data.positionId = input.position_id;
    if (input.location_id !== undefined) data.locationId = input.location_id;
    if (input.schedule_id !== undefined) data.scheduleId = input.schedule_id;
    if (input.phone !== undefined) data.phone = nextPhone;
    if (input.is_flexible_location !== undefined) data.isFlexibleLocation = input.is_flexible_location;
    if (input.allow_replacement_off !== undefined) data.allowReplacementOff = input.allow_replacement_off;
    if (input.allow_schedule_selection !== undefined) data.allowScheduleSelection = input.allow_schedule_selection;
    if (input.allow_multiple_checkout !== undefined) data.allowMultipleCheckout = input.allow_multiple_checkout;
    if (input.allow_half_day !== undefined) data.allowHalfDay = input.allow_half_day;
    if (input.allow_joint_leave !== undefined) data.allowJointLeave = input.allow_joint_leave;
    if (input.is_active !== undefined) data.isActive = input.is_active;
    if (input.password) {
      if (input.password.length < 8) throw err('INVALID_PASSWORD', 400);
      data.passwordHash = await bcrypt.hash(input.password, 10);
    }
    const updated = await c.user.update({
      where: { id },
      data,
      include: { position: true, location: true },
    });
    return this.toRecord(updated);
  }

  async remove(companyId: number, id: number) {
    const c = this.client();
    const user = await c.user.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!user) throw err('USER_NOT_FOUND', 404);
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return true;
  }

  async getDirectReports(companyId: number, supervisorId: number) {
    const c = this.client();
    return c.user.findMany({
      where: { companyId, directLeadId: supervisorId, deletedAt: null, isActive: true },
      select: { id: true, namaLengkap: true, email: true, nip: true },
    });
  }

  /** Recursively collect subtree user ids for supervisor scope. */
  async subtreeIds(companyId: number, rootId: number): Promise<number[]> {
    const c = this.client();
    const result = new Set<number>([rootId]);
    let frontier = [rootId];
    for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
      const children = await c.user.findMany({
        where: { companyId, directLeadId: { in: frontier }, deletedAt: null },
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

  async pendingCounts(companyId: number, supervisorId: number) {
    const c = this.client();
    const ids = await this.subtreeIds(companyId, supervisorId);
    const reportIds = ids.filter((id) => id !== supervisorId);
    const [cuti, replacement] = await Promise.all([
      c.leaveRequest.count({
        where: { companyId, userId: { in: reportIds }, status: 'pending', deletedAt: null },
      }),
      c.replacementOff.count({
        where: { companyId, userId: { in: reportIds }, status: 'pending', deletedAt: null },
      }),
    ]);
    // cuti+izin share leave_requests table (category LEAVE|PERMIT|SICK)
    const [izin, cutiOnly] = await Promise.all([
      c.leaveRequest.count({
        where: {
          companyId,
          userId: { in: reportIds },
          status: 'pending',
          deletedAt: null,
          leaveType: { category: { in: ['PERMIT', 'SICK'] } },
        },
      }),
      c.leaveRequest.count({
        where: {
          companyId,
          userId: { in: reportIds },
          status: 'pending',
          deletedAt: null,
          leaveType: { category: 'LEAVE' },
        },
      }),
    ]);
    return { cuti: cutiOnly, izin, replacement_off: replacement, total: cuti + replacement };
  }
}
