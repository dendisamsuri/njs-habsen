import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/prisma.module';
import { err } from '../common/exceptions';
import { todayIso, dayOfWeek, isValidIsoDate } from '../common/time.util';
import { UsersService } from '../users/users.service';

const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const WEEKLY_OFF = [0]; // Sunday default weekly off

export interface ReportScope {
  // null = platform admin, no tenant filter
  companyId: number | null;
  supervisorUserId?: number | null; // when role SUPERVISOR → subtree only
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly users: UsersService,
  ) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  // Prisma rejects companyId: null — omit the filter instead.
  private cw(scope: ReportScope) {
    return scope.companyId == null ? {} : { companyId: scope.companyId };
  }

  private async scopeUserIds(scope: ReportScope): Promise<number[] | null> {
    if (!scope.supervisorUserId || scope.companyId == null) return null;
    return this.users.subtreeIds(scope.companyId, scope.supervisorUserId);
  }

  async filters(scope: ReportScope) {
    const c = this.c();
    const [lokasi, posisi, employees] = await Promise.all([
      c.location.findMany({ orderBy: { name: 'asc' } }),
      c.position.findMany({ orderBy: { name: 'asc' } }),
      c.user.findMany({
        where: {
          ...this.cw(scope),
          deletedAt: null,
          isActive: true,
          ...(scope.supervisorUserId
            ? { id: { in: (await this.scopeUserIds(scope)) ?? [] } }
            : {}),
        },
        orderBy: { namaLengkap: 'asc' },
        select: { id: true, namaLengkap: true },
      }),
    ]);
    return {
      lokasi: lokasi.map((l: any) => ({ lokasi_id: l.id, lokasi_nama: l.name })),
      posisi: posisi.map((p: any) => ({ posisi_id: p.id, posisi_nama: p.name })),
      company: [],
      multi_company_active: 'N',
      employees: employees.map((u: any) => ({
        user_id: u.id,
        nama_lengkap: u.namaLengkap,
      })),
    };
  }

  private async holidaysMap(companyId: number | null, startIso: string, endIso: string) {
    const c = this.c();
    const rows = await c.holiday.findMany({
      where: {
        ...(companyId == null ? {} : { companyId }),
        date: { gte: new Date(startIso), lte: new Date(endIso) },
      },
    });
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[todayIso(new Date(r.date))] = r.name;
    }
    return map;
  }

  private listDates(startIso: string, endIso: string): string[] {
    const out: string[] = [];
    const [y1, m1, d1] = startIso.split('-').map(Number);
    const [y2, m2, d2] = endIso.split('-').map(Number);
    const cur = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    while (cur <= end) {
      out.push(todayIso(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  /** Monthly matrix report (laporan-hari + laporan-tanggal shared core). */
  async matrix(
    scope: ReportScope,
    params: {
      start_date: string;
      end_date: string;
      lokasi_id?: number;
      posisi_id?: number;
      user_id?: number;
      page?: number;
      limit?: number;
    },
  ) {
    if (!isValidIsoDate(params.start_date) || !isValidIsoDate(params.end_date)) {
      throw err('INVALID_DATE_FORMAT', 400);
    }
    if (params.start_date > params.end_date) throw err('REPORT_INVALID_RANGE', 400);
    const span =
      (Date.parse(params.end_date) - Date.parse(params.start_date)) / 86400000;
    if (span > 365) throw err('REPORT_INVALID_RANGE', 400);

    const c = this.c();
    const scopeIds = await this.scopeUserIds(scope);
    const where: any = {
      ...this.cw(scope),
      deletedAt: null,
      isActive: true,
      ...(scopeIds ? { id: { in: scopeIds } } : {}),
      ...(params.lokasi_id ? { locationId: params.lokasi_id } : {}),
      ...(params.posisi_id ? { positionId: params.posisi_id } : {}),
      ...(params.user_id ? { id: params.user_id } : {}),
    };

    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 200);
    const totalUsers = await c.user.count({ where });
    const users = await c.user.findMany({
      where,
      include: { position: true },
      orderBy: { namaLengkap: 'asc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const dates = this.listDates(params.start_date, params.end_date);
    const attendance = await c.attendances.findMany({
      where: {
        ...this.cw(scope),
        tanggal: { gte: new Date(params.start_date), lte: new Date(params.end_date) },
        ...(params.user_id ? { userId: params.user_id } : {}),
        userId: params.user_id
          ? params.user_id
          : users.length
            ? { in: users.map((u: any) => u.id) }
            : { in: [] },
      },
    });
    const attMap: Record<string, any> = {};
    for (const a of attendance) {
      attMap[`${a.userId}|${todayIso(new Date(a.tanggal))}`] = a;
    }
    const holidayMap = await this.holidaysMap(scope.companyId, params.start_date, params.end_date);

    // approved leaves for special status
    const leaves = await c.leaveRequest.findMany({
      where: {
        ...this.cw(scope),
        status: 'approved',
        deletedAt: null,
        startDate: { lte: new Date(params.end_date) },
        endDate: { gte: new Date(params.start_date) },
      },
      include: { leaveType: true },
    });
    const ros = await c.replacementOff.findMany({
      where: {
        ...this.cw(scope),
        status: 'approved',
        deletedAt: null,
        originalDate: { gte: new Date(params.start_date), lte: new Date(params.end_date) },
      },
    });
    const leaveMap: Record<string, any[]> = {};
    for (const l of leaves) {
      for (const d of this.listDates(todayIso(new Date(l.startDate)), todayIso(new Date(l.endDate)))) {
        (leaveMap[d] ??= []).push(l);
      }
    }
    const roMap: Record<string, any> = {};
    for (const r of ros) {
      roMap[todayIso(new Date(r.originalDate))] = r;
    }

    const today = todayIso();
    const rows = users.map((u: any) => {
      const days: Record<string, any> = {};
      const summary = { hadir: 0, telat: 0, alpha: 0, izin: 0, cuti: 0, libur: 0 };
      for (const d of dates) {
        const att = attMap[`${u.id}|${d}`];
        const dow = dayOfWeek(d);
        const weeklyOff = WEEKLY_OFF.includes(dow);
        const national = holidayMap[d] ?? null;
        const isHoliday = weeklyOff && !att;
        const lv = leaveMap[d] ?? [];
        const ro = roMap[d];

        let type: string | undefined;
        let status = 'attendance';
        let statusLabel: string | undefined;
        let special: string | undefined;

        if (att) {
          type = 'attendance';
          statusLabel = att.kehadiran;
        } else if (isHoliday) {
          status = 'holiday';
          statusLabel = national ?? 'Libur';
          summary.libur += 1;
        } else if (d > today) {
          status = 'future';
          statusLabel = 'Belum berlangsung';
        } else {
          type = 'alpha';
          status = 'alpha';
          statusLabel = 'Alpha';
        }

        if (lv.length && d <= today) {
          const full = lv.find((x: any) => Number(x.totalDays) >= 1);
          const half = lv.find((x: any) => Number(x.totalDays) < 1);
          if (full) special = 'CH';
          else if (half) special = 'RH';
        }
        if (ro && d <= today) {
          special = ro.isHalfDay ? 'RH' : 'R';
        }

        if (att) {
          if (att.kehadiran === 'HADIR') summary.hadir += 1;
          if (att.statusMasuk === 'TERLAMAT') summary.telat += 1;
          if (att.kehadiran === 'IZIN') summary.izin += 1;
          if (att.kehadiran === 'CUTI') summary.cuti += 1;
        }

        days[d] = {
          date: d,
          day_code: DAYS_ID[dow],
          day_label: DAYS_ID[dow],
          is_holiday: isHoliday,
          is_national_holiday: !!national,
          holiday_note: national,
          type,
          status,
          status_label: statusLabel,
          special_status: special,
          absen_in: att?.checkIn ?? null,
          absen_out: att?.checkOut ?? null,
          status_masuk: att?.statusMasuk ?? null,
          status_pulang: att?.statusPulang ?? null,
          kehadiran: att?.kehadiran ?? null,
        };
      }

      const workDays = dates.length - summary.libur;
      summary.alpha = Math.max(0, workDays - summary.hadir - summary.izin - summary.cuti);

      return {
        user_id: u.id,
        nip: u.nip,
        nama_lengkap: u.namaLengkap,
        posisi_nama: u.position?.name ?? null,
        company_nama: null,
        days,
        summary,
      };
    });

    const totalRows = totalUsers;
    return {
      period:
        params.start_date.slice(0, 7) === params.end_date.slice(0, 7)
          ? {
              bulan: Number(params.start_date.slice(5, 7)),
              tahun: Number(params.start_date.slice(0, 4)),
              start_date: params.start_date,
              end_date: params.end_date,
              total_days: dates.length,
              month_name: MONTHS_ID[Number(params.start_date.slice(5, 7)) - 1],
            }
          : {
              start_date: params.start_date,
              end_date: params.end_date,
              total_days: dates.length,
            },
      dates,
      holidays: {
        weekly: WEEKLY_OFF,
        national: holidayMap,
      },
      rows,
      pagination: {
        page,
        limit,
        total_rows: totalRows,
        total_pages: Math.max(1, Math.ceil(totalRows / limit)),
      },
    };
  }

  async monthRange(month: number, year: number): Promise<{ start: string; end: string }> {
    if (!(month >= 1 && month <= 12)) throw err('VALIDATION_ERROR', 400);
    if (!(year >= 2000 && year <= 2100)) throw err('VALIDATION_ERROR', 400);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }

  /** Single-day report (laporan-hari-ini). */
  async hariIni(
    scope: ReportScope,
    params: { tanggal: string; lokasi_id?: number; posisi_id?: number; page?: number; limit?: number },
  ) {
    if (!isValidIsoDate(params.tanggal)) throw err('INVALID_DATE_FORMAT', 400);
    const c = this.c();
    const scopeIds = await this.scopeUserIds(scope);
    const where: any = {
      ...this.cw(scope),
      deletedAt: null,
      isActive: true,
      ...(scopeIds ? { id: { in: scopeIds } } : {}),
      ...(params.lokasi_id ? { locationId: params.lokasi_id } : {}),
      ...(params.posisi_id ? { positionId: params.posisi_id } : {}),
    };
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);
    const total = await c.user.count({ where });
    const users = await c.user.findMany({
      where,
      include: { position: true },
      orderBy: { namaLengkap: 'asc' },
      take: limit,
      skip: (page - 1) * limit,
    });
    const atts = await c.attendances.findMany({
      where: {
        ...this.cw(scope),
        tanggal: new Date(params.tanggal),
        userId: { in: users.map((u: any) => u.id) },
      },
    });
    const map: Record<number, any> = {};
    for (const a of atts) map[a.userId] = a;

    const rows = users
      .map((u: any) => {
        const a = map[u.id];
        return {
          user_id: u.id,
          tanggal: params.tanggal,
          absen_in: a?.checkIn ?? null,
          absen_out: a?.checkOut ?? null,
          foto_in: a?.photoIn ?? null,
          foto_out: a?.photoOut ?? null,
          status_masuk: a?.statusMasuk ?? null,
          status_pulang: a?.statusPulang ?? null,
          latitude_longtitude_in:
            a?.latitudeIn != null && a?.longitudeIn != null
              ? `${a.latitudeIn},${a.longitudeIn}`
              : null,
          latitude_longtitude_out:
            a?.latitudeOut != null && a?.longitudeOut != null
              ? `${a.latitudeOut},${a.longitudeOut}`
              : null,
          kehadiran: a?.kehadiran ?? null,
          tipe: a?.tipe ?? null,
          nip: u.nip,
          nama_lengkap: u.namaLengkap,
          posisi_nama: u.position?.name ?? null,
          company_nama: null,
        };
      })
      .sort((x, y) => (x.absen_in ?? 'zz') < (y.absen_in ?? 'zz') ? -1 : 1);

    return {
      tanggal: params.tanggal,
      rows,
      pagination: {
        page,
        limit,
        total_rows: total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** Per-employee month detail (laporan-pegawai). */
  async pegawai(
    scope: ReportScope,
    params: { employee_id: number; month: number; year: number },
  ) {
    if (!(params.month >= 1 && params.month <= 12)) throw err('VALIDATION_ERROR', 400);
    const c = this.c();
    const user = await c.user.findFirst({
      where: {
        id: params.employee_id,
        ...this.cw(scope),
        deletedAt: null,
      },
      include: { position: true },
    });
    if (!user) throw err('USER_NOT_FOUND', 404);
    if (scope.supervisorUserId && scope.companyId != null && scope.supervisorUserId !== user.id) {
      const ids = await this.users.subtreeIds(scope.companyId, scope.supervisorUserId);
      if (!ids.includes(user.id)) throw err('SUPERVISOR_SCOPE_DENIED', 403);
    }

    const { start, end } = await this.monthRange(params.month, params.year);
    const dates = this.listDates(start, end);
    const atts = await c.attendances.findMany({
      where: {
        ...this.cw(scope),
        userId: user.id,
        tanggal: { gte: new Date(start), lte: new Date(end) },
      },
    });
    const map: Record<string, any> = {};
    for (const a of atts) map[todayIso(new Date(a.tanggal))] = a;
    const holidayMap = await this.holidaysMap(scope.companyId, start, end);
    const today = todayIso();

    const summary = { hadir: 0, terlambat: 0, alpha: 0, izin: 0, cuti: 0 };
    const days = dates.map((d) => {
      const att = map[d] ?? null;
      const dow = dayOfWeek(d);
      const weeklyOff = WEEKLY_OFF.includes(dow);
      const national = holidayMap[d] ?? null;
      const isHoliday = weeklyOff && !att;
      let status: string;
      let statusLabel: string;
      if (att) {
        status = 'attendance';
        statusLabel = att.kehadiran;
        if (att.kehadiran === 'HADIR') summary.hadir += 1;
        if (att.statusMasuk === 'TERLAMAT') summary.terlambat += 1;
        if (att.kehadiran === 'IZIN') summary.izin += 1;
        if (att.kehadiran === 'CUTI') summary.cuti += 1;
      } else if (isHoliday) {
        status = 'holiday';
        statusLabel = national ?? 'Libur';
      } else if (d > today) {
        status = 'future';
        statusLabel = 'Belum berlangsung';
      } else {
        status = 'alpha';
        statusLabel = 'Alpha';
        summary.alpha += 1;
      }
      return {
        number: Number(d.slice(8)),
        date: d,
        is_holiday: isHoliday,
        holiday_note: national,
        weekend_holiday_worked: weeklyOff && att?.kehadiran === 'HADIR',
        national_holiday_worked: !!national && att?.kehadiran === 'HADIR',
        attendance: att
          ? {
              absen_id: att.id,
              user_id: att.userId,
              tanggal: d,
              absen_in: att.checkIn,
              absen_out: att.checkOut,
              status_masuk: att.statusMasuk,
              status_pulang: att.statusPulang,
              kehadiran: att.kehadiran,
              tipe: att.tipe,
              foto_in: att.photoIn,
              foto_out: att.photoOut,
            }
          : null,
        histories: [],
        status,
        status_label: statusLabel,
      };
    });

    return {
      employee: {
        user_id: user.id,
        nip: user.nip,
        nama_lengkap: user.namaLengkap,
        posisi_nama: user.position?.name ?? null,
        company_nama: null,
      },
      period: { month: params.month, year: params.year },
      days,
      summary,
    };
  }

  /** Process log listing by date. */
  async processLog(
    scope: ReportScope,
    params: {
      date: string;
      employee_id?: number;
      search?: string;
      attendance_type?: string;
      final_status?: string;
      page?: number;
      limit?: number;
      action?: string;
      flow_id?: string;
    },
  ) {
    if (!isValidIsoDate(params.date)) throw err('INVALID_DATE_FORMAT', 400);
    const c = this.c();

    if (params.action === 'events' && params.flow_id) {
      const events = await c.attendanceProcessEvent.findMany({
        where: { flowId: params.flow_id },
        orderBy: { createdAt: 'asc' },
      });
      return events.map((e: any, i: number) => ({
        flow_id: e.flowId,
        event_sequence: i + 1,
        event_type: e.stage,
        event_status: e.status,
        message: e.message,
        context: e.payload,
        created_at: e.createdAt,
      }));
    }

    const start = new Date(`${params.date}T00:00:00`);
    const end = new Date(`${params.date}T00:00:00`);
    end.setDate(end.getDate() + 1);

    const where: any = {
      ...this.cw(scope),
      createdAt: { gte: start, lt: end },
      ...(params.employee_id ? { userId: params.employee_id } : {}),
    };
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 50);

    const logs = await c.attendanceProcessLog.findMany({
      where,
      include: {
        events: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byUser: Record<number, any> = {};
    for (const log of logs) {
      if (!log.userId) continue;
      const u = (byUser[log.userId] ??= {
        user_id: log.userId,
        nama_lengkap: null,
        lokasi_nama: null,
        attempt_count: 0,
        success_count: 0,
        failed_count: 0,
        processing_count: 0,
        latest_started_at: log.createdAt,
        attempts: [],
      });
      u.attempt_count += 1;
      if (log.status === 'SUCCESS') u.success_count += 1;
      else if (log.status === 'FAILED') u.failed_count += 1;
      else u.processing_count += 1;
      if (new Date(log.createdAt) > new Date(u.latest_started_at)) {
        u.latest_started_at = log.createdAt;
      }
      const lastEvent = log.events[log.events.length - 1];
      u.attempts.push({
        flow_id: log.flowId,
        user_id: log.userId,
        attendance_type: null,
        attendance_method: null,
        started_at: log.createdAt,
        finished_at: log.updatedAt,
        final_status: log.status,
        final_stage: log.stage,
        final_message: lastEvent?.message ?? null,
        absen_id: log.attendanceId,
        duration_seconds: Math.round(
          (new Date(log.updatedAt).getTime() - new Date(log.createdAt).getTime()) / 1000,
        ),
      });
    }

    // enrich names
    const ids = Object.keys(byUser).map(Number);
    if (ids.length) {
      const users = await c.user.findMany({
        where: { id: { in: ids } },
        include: { location: true },
      });
      const umap: Record<number, any> = {};
      for (const u of users) umap[u.id] = u;
      for (const id of ids) {
        byUser[id].nama_lengkap = umap[id]?.namaLengkap ?? null;
        byUser[id].lokasi_nama = umap[id]?.location?.name ?? null;
      }
    }

    let employees = Object.values(byUser) as any[];
    if (params.search) {
      const q = params.search.toLowerCase();
      employees = employees.filter((e) => (e.nama_lengkap ?? '').toLowerCase().includes(q));
    }
    employees.sort(
      (a, b) =>
        new Date(b.latest_started_at).getTime() - new Date(a.latest_started_at).getTime() ||
        String(a.nama_lengkap).localeCompare(String(b.nama_lengkap)),
    );
    const total = employees.length;
    const paged = employees.slice((page - 1) * limit, page * limit);

    return {
      employees: paged,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** Koreksi absen (AdminAbsenController::updateAttendanceTime). */
  async correctAttendance(
    scope: ReportScope,
    actorId: number,
    input: {
      absen_id: number;
      absen_in?: string | null;
      absen_out?: string | null;
      reason: string;
      source?: string;
    },
  ) {
    const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!input.reason || input.reason.length < 1 || input.reason.length > 500) {
      throw err('CORRECTION_REASON_REQUIRED', 400);
    }
    if (input.source && input.source !== 'admin-api') {
      throw err('VALIDATION_ERROR', 400);
    }
    if (input.absen_in != null && !TIME_RE.test(input.absen_in)) {
      throw err('VALIDATION_ERROR', 400);
    }
    if (input.absen_out != null && !TIME_RE.test(input.absen_out)) {
      throw err('VALIDATION_ERROR', 400);
    }

    const c = this.c();
    const scopeIds = await this.scopeUserIds(scope);
    const where: any = {
      id: input.absen_id,
      ...this.cw(scope),
      ...(scopeIds ? { userId: { in: scopeIds } } : {}),
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.attendances.findFirst({ where });
        if (!row) throw err('CORRECTION_NOT_FOUND', 404);

        const newIn = input.absen_in !== undefined ? input.absen_in : row.checkIn;
        const newOut = input.absen_out !== undefined ? input.absen_out : row.checkOut;

        let statusMasuk = row.statusMasuk;
        if (input.absen_in !== undefined && input.absen_in !== row.checkIn && input.absen_in) {
          const telatAt = row.scheduleTimeIn
            ? this.addMinutes(row.scheduleTimeIn, row.toleranceMinutes ?? 0)
            : null;
          statusMasuk = telatAt && input.absen_in > telatAt ? 'TERLAMAT' : 'TEPAT_WAKTU';
        }

        let statusPulang = row.statusPulang;
        if (input.absen_out !== undefined && input.absen_out !== row.checkOut && input.absen_out) {
          statusPulang =
            row.scheduleTimeOut && input.absen_out < this.norm(row.scheduleTimeOut)
              ? 'PULANG_CEPAT'
              : null;
        }

        if (
          newIn === row.checkIn &&
          newOut === row.checkOut &&
          statusMasuk === row.statusMasuk &&
          statusPulang === row.statusPulang
        ) {
          throw err('CONFLICT', 409);
        }

        const before = {
          absen_in: row.checkIn,
          absen_out: row.checkOut,
          status_masuk: row.statusMasuk,
          status_pulang: row.statusPulang,
        };
        const updated = await tx.attendances.update({
          where: { id: row.id },
          data: {
            checkIn: (newIn as any) ?? null,
            checkOut: (newOut as any) ?? null,
            statusMasuk,
            statusPulang: statusPulang ?? null,
          },
        });
        await tx.attendanceCorrectionAudit.create({
          data: {
            companyId: row.companyId,
            attendanceId: row.id,
            actorId,
            before: before as any,
            after: {
              absen_in: updated.checkIn,
              absen_out: updated.checkOut,
              status_masuk: updated.statusMasuk,
              status_pulang: updated.statusPulang,
            } as any,
            reason: input.reason,
          },
        });
        return {
          absen_id: updated.id,
          absen_in: updated.checkIn,
          absen_out: updated.checkOut,
          status_masuk: updated.statusMasuk,
          status_pulang: updated.statusPulang,
        };
      });
    } catch (e: any) {
      if (e?.errorCode) throw e;
      // eslint-disable-next-line no-console
      console.error(e);
      throw err('SERVER_ERROR', 500);
    }
  }

  private norm(t: string): string {
    return t.length === 5 ? `${t}:00` : t;
  }

  private addMinutes(t: string, minutes: number): string {
    const [h, m, s] = this.norm(t).split(':').map(Number);
    const total = h * 3600 + m * 60 + (s || 0) + minutes * 60;
    const hh = Math.floor(total / 3600) % 24;
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  async checkAbsen(
    scope: ReportScope,
    params: { nip?: string; user_id?: number; tanggal?: string; start_date?: string; end_date?: string; limit?: number },
  ) {
    const c = this.c();
    const scopeIds = await this.scopeUserIds(scope);
    const userWhere: any = {
      ...this.cw(scope),
      deletedAt: null,
      ...(scopeIds ? { id: { in: scopeIds } } : {}),
      ...(params.nip ? { nip: params.nip } : {}),
      ...(params.user_id ? { id: params.user_id } : {}),
    };
    const user = await c.user.findFirst({ where: userWhere });
    if (!user) throw err('ATTENDANCE_NOT_FOUND', 404);

    if (params.tanggal) {
      const row = await c.attendances.findFirst({
        where: { ...this.cw(scope), userId: user.id, tanggal: new Date(params.tanggal) },
      });
      if (!row) throw err('ATTENDANCE_NOT_FOUND', 404);
      return {
        absen_id: row.id,
        user_id: row.userId,
        tanggal: params.tanggal,
        absen_in: row.checkIn,
        absen_out: row.checkOut,
        jam_kerja_in: row.scheduleTimeIn,
        jam_kerja_toleransi: row.scheduleTimeOut && row.toleranceMinutes != null
          ? this.addMinutes(row.scheduleTimeIn ?? '00:00:00', row.toleranceMinutes)
          : null,
        jam_kerja_out: row.scheduleTimeOut,
        status_masuk: row.statusMasuk,
        status_pulang: row.statusPulang,
        kehadiran: row.kehadiran,
        keterangan: row.notes,
        nip: user.nip,
      };
    }

    if (params.start_date && params.end_date) {
      const rows = await c.attendances.findMany({
        where: {
          ...this.cw(scope),
          userId: user.id,
          tanggal: { gte: new Date(params.start_date), lte: new Date(params.end_date) },
        },
        orderBy: { tanggal: 'desc' },
        take: Math.min(Math.max(params.limit ?? 30, 1), 200),
      });
      return {
        history: rows.map((r: any) => ({
          absen_id: r.id,
          user_id: r.userId,
          tanggal: todayIso(new Date(r.tanggal)),
          absen_in: r.checkIn,
          absen_out: r.checkOut,
          status_masuk: r.statusMasuk,
          status_pulang: r.statusPulang,
          kehadiran: r.kehadiran,
          nip: user.nip,
        })),
      };
    }

    throw err('VALIDATION_ERROR', 400);
  }
}
