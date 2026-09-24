import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/prisma.module';
import { AttendanceLocationService } from './attendance-location.service';
import { AttendancePhotoService } from './attendance-photo.service';
import { ProcessLogService } from './process-log.service';
import { FaceService } from '../face/face.service';
import { err, AppException } from '../common/exceptions';
import {
  todayIso,
  nowHms,
  dayName,
  isSentinelTime,
  normalizeTimeInput,
  dateRange,
} from '../common/time.util';

export interface CheckInInput {
  latitude: number;
  longitude: number;
  schedule_id?: number;
  img?: string;
  tipe?: string; // selfie|recognition
  flow_id?: string;
}

export interface CheckOutInput {
  latitude: number;
  longitude: number;
  img?: string;
  tipe?: string;
  flow_id?: string;
}

interface ScheduleSlot {
  scheduleId: number;
  timeIn: string; // HH:MM:SS
  jamTelat: string; // timeIn + tolerance
  timeOut: string;
  toleranceMinutes: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly locations: AttendanceLocationService,
    private readonly photos: AttendancePhotoService,
    private readonly processLog: ProcessLogService,
    private readonly face: FaceService,
  ) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  // ---------- schedule resolution (AbsenModel::getUserWorkSchedule) ----------

  private addTolerance(timeIn: string, tolMinutes: number): string {
    const [h, m, s] = normalizeTimeInput(timeIn).split(':').map(Number);
    const total = h * 3600 + m * 60 + (s || 0) + tolMinutes * 60;
    const hh = Math.floor(total / 3600) % 24;
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  async getUserWorkSchedule(userId: number, dateIso: string, chosenScheduleId?: number): Promise<ScheduleSlot | null> {
    const c = this.c();
    const day = dayName(dateIso);
    const user = await c.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) return null;

    let slots: ScheduleSlot[] = [];

    // multi-schedule assignments (legacy user_jam_kerja), else single users.schedule_id
    const assigned = await c.userSchedule.findMany({ where: { userId, isActive: true }, orderBy: { id: 'asc' } });
    const assignedIds = assigned.map((a: any) => a.scheduleId);
    if (assignedIds.length === 0 && user.scheduleId) assignedIds.push(user.scheduleId);
    if (assignedIds.length > 0) {
      const details = await c.scheduleDetail.findMany({
        where: {
          scheduleId: { in: assignedIds },
          dayOfWeek: day as any,
          isActive: true,
        },
        include: { schedule: true },
      });
      slots = details
        .filter((d: any) => d.schedule.isActive)
        .map((d: any) => ({
          scheduleId: d.scheduleId,
          timeIn: normalizeTimeInput(d.timeIn),
          jamTelat: this.addTolerance(d.timeIn, d.toleranceMinutes),
          timeOut: normalizeTimeInput(d.timeOut),
          toleranceMinutes: d.toleranceMinutes,
        }));
    }

    // chosen schedule override (allow_schedule_selection + schedule_id > 0)
    if (
      chosenScheduleId &&
      chosenScheduleId > 0 &&
      user.allowScheduleSelection
    ) {
      const details = await c.scheduleDetail.findMany({
        where: { scheduleId: chosenScheduleId, dayOfWeek: day as any, isActive: true },
        include: { schedule: true },
      });
      const chosen = details
        .filter((d: any) => d.schedule.isActive)
        .map((d: any) => ({
          scheduleId: d.scheduleId,
          timeIn: normalizeTimeInput(d.timeIn),
          jamTelat: this.addTolerance(d.timeIn, d.toleranceMinutes),
          timeOut: normalizeTimeInput(d.timeOut),
          toleranceMinutes: d.toleranceMinutes,
        }));
      if (chosen.length === 1) return chosen[0];
      if (chosen.length > 1) return this.pickClosest(chosen);
      // fall through to auto-detect if chosen invalid
    }

    if (slots.length === 0) return null;
    if (slots.length === 1) return slots[0];
    return this.pickClosest(slots);
  }

  private pickClosest(slots: ScheduleSlot[]): ScheduleSlot {
    const now = nowHms();
    const nowSec = this.toSec(now);
    let best = slots[0];
    let bestDiff = Math.abs(nowSec - this.toSec(slots[0].timeIn));
    for (let i = 1; i < slots.length; i++) {
      const diff = Math.abs(nowSec - this.toSec(slots[i].timeIn));
      if (diff < bestDiff) {
        best = slots[i];
        bestDiff = diff;
      }
    }
    return best;
  }

  private toSec(t: string): number {
    const [h, m, s] = normalizeTimeInput(t).split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
  }

  // ---------- blocking checks ----------

  private async assertNotBlocked(c: any, companyId: number, userId: number, dateIso: string) {
    const leave = await c.leaveRequest.findFirst({
      where: {
        companyId,
        userId,
        status: 'approved',
        deletedAt: null,
        startDate: { lte: new Date(dateIso) },
        endDate: { gte: new Date(dateIso) },
        totalDays: { gte: 1 },
      },
      include: { leaveType: true },
    });
    if (leave) {
      throw leave.leaveType.category === 'PERMIT' || leave.leaveType.category === 'SICK'
        ? err('BLOCKED_BY_PERMIT', 400)
        : err('BLOCKED_BY_LEAVE', 400);
    }

    const ro = await c.replacementOff.findFirst({
      where: {
        companyId,
        userId,
        status: 'approved',
        deletedAt: null,
        originalDate: new Date(dateIso),
        isHalfDay: false,
      },
    });
    if (ro) throw err('BLOCKED_BY_REPLACEMENT_OFF', 400);
  }

  // ---------- check-in ----------

  async checkIn(user: any, input: CheckInInput): Promise<any> {
    const companyId = user.companyId!;
    const userId = user.id;
    const dateIso = todayIso();
    const time = nowHms();
    const flowId =
      input.flow_id ??
      (await this.processLog.start(companyId, userId, 'radius_validation'));

    const c = this.c();

    // 1-3 leave/permit/replacement blocks
    await this.assertNotBlocked(c, companyId, userId, dateIso);

    // 4 schedule
    const schedule = await this.getUserWorkSchedule(userId, dateIso, input.schedule_id ?? 0);
    if (!schedule) {
      await this.processLog.fail(flowId, 'server_validation', 'NO_SCHEDULE_TODAY');
      throw err('NO_SCHEDULE_TODAY', 400);
    }

    // 5 radius
    const check = await this.locations.check(
      companyId,
      user.isFlexibleLocation === true,
      input.latitude,
      input.longitude,
    );
    const radiusPayload = {
      location_name: check.locationName,
      distance_meters: check.distanceMeters !== null ? Math.round(check.distanceMeters * 100) / 100 : null,
      allowed_radius_meters: check.radiusMeters,
      flexible_location: check.flexible,
    };
    if (!check.ok) {
      await this.processLog.fail(flowId, 'radius_validation', 'LOCATION_OUT_OF_RADIUS', radiusPayload);
      throw err('LOCATION_OUT_OF_RADIUS', 400);
    }
    await this.processLog.succeed(flowId, 'radius_validation', radiusPayload);

    // 6 existing row → idempotent success
    const existing = await c.attendances.findFirst({
      where: { companyId, userId, tanggal: new Date(dateIso) },
    });
    if (existing) {
      await this.processLog.fail(flowId, 'attendance_persistence', 'ATTENDANCE_ALREADY_RECORDED', {
        absen_id: existing.id,
        stage: 'already_recorded',
      });
      return {
        already_recorded: true,
        persisted: false,
        absen_id: existing.id,
        check_in: existing.checkIn,
        message_key: 'ATTENDANCE_ALREADY_RECORDED',
      };
    }

    // face verify when company setting = recognition
    let tipe = input.tipe ?? 'selfie';
    const settings = await c.companySetting.findFirst({ where: { companyId } });
    if (settings?.tipeAbsen === 'recognition') {
      const faceRow = await c.faceRecognition.findFirst({ where: { companyId, userId } });
      if (!faceRow) throw err('FACE_NOT_REGISTERED', 400);
      if (!input.img) throw err('PHOTO_REQUIRED', 400);
      await this.processLog.event(flowId, 'face_recognition', 'PENDING', 'verifying');
      try {
        const result = await this.face.verify(faceRow.photoPath, input.img);
        if (!result.matched) {
          await this.processLog.fail(flowId, 'face_recognition', 'FACE_VERIFY_FAILED');
          throw err('FACE_VERIFY_FAILED', 400);
        }
        tipe = 'recognition';
        await this.processLog.succeed(flowId, 'face_recognition', { similarity: result.similarity });
      } catch (e: any) {
        const code = typeof e?.errorCode === 'string' ? e.errorCode : 'FACE_VERIFY_FAILED';
        if (code !== 'FACE_VERIFY_FAILED') {
          await this.processLog.fail(flowId, 'face_recognition', code);
        }
        throw e;
      }
    }

    // photo
    let photoName: string | null = null;
    if (input.img) {
      try {
        photoName = await this.photos.upload(input.img, userId, 'masuk');
      } catch (e) {
        await this.processLog.fail(flowId, 'photo', 'PHOTO_UPLOAD_FAILED');
        throw e;
      }
      await this.processLog.succeed(flowId, 'photo', { photo: photoName });
    }

    const statusMasuk = time <= schedule.jamTelat ? 'TEPAT_WAKTU' : 'TERLAMAT';

    try {
      const row = await c.attendances.create({
        data: {
          companyId,
          userId,
          tanggal: new Date(dateIso),
          scheduleId: schedule.scheduleId,
          scheduleTimeIn: schedule.timeIn,
          scheduleTimeOut: schedule.timeOut,
          toleranceMinutes: schedule.toleranceMinutes,
          checkIn: time,
          checkOut: null,
          statusMasuk,
          statusPulang: null,
          kehadiran: 'HADIR',
          latitudeIn: input.latitude,
          longitudeIn: input.longitude,
          locationIdIn: check.locationId && check.locationId > 0 ? check.locationId : null,
          photoIn: photoName,
          tipe,
          isFlexible: check.flexible,
        },
      });
      await this.processLog.succeed(flowId, 'attendance_persistence', { absen_id: row.id });
      return {
        already_recorded: false,
        persisted: true,
        absen_id: row.id,
        check_in: row.checkIn,
        status_masuk: row.statusMasuk,
        message_key: 'SUCCESS',
      };
    } catch (e: any) {
      if (photoName) await this.photos.cleanup(photoName);
      // unique race → idempotent
      if (String(e?.message).includes('UNIQUE') || e?.code === 'P2002') {
        const again = await c.attendances.findFirst({
          where: { companyId, userId, tanggal: new Date(dateIso) },
        });
        if (again) {
          return {
            already_recorded: true,
            persisted: false,
            absen_id: again.id,
            check_in: again.checkIn,
            message_key: 'ATTENDANCE_ALREADY_RECORDED',
          };
        }
      }
      await this.processLog.fail(flowId, 'attendance_persistence', 'SERVER_ERROR');
      throw err('SERVER_ERROR', 500);
    }
  }

  // ---------- check-out ----------

  async checkOut(user: any, input: CheckOutInput): Promise<any> {
    const companyId = user.companyId!;
    const userId = user.id;
    const dateIso = todayIso();
    const time = nowHms();
    const flowId =
      input.flow_id ?? (await this.processLog.start(companyId, userId, 'radius_validation'));

    const c = this.c();

    await this.assertNotBlocked(c, companyId, userId, dateIso);

    const row = await c.attendances.findFirst({
      where: { companyId, userId, tanggal: new Date(dateIso) },
    });
    if (!row) throw err('ATTENDANCE_NOT_CHECKED_IN', 400);

    const allowMultiple = user.allowMultipleCheckout === true;
    if (!allowMultiple && !isSentinelTime(row.checkOut)) {
      throw err('ATTENDANCE_ALREADY_CHECKED_OUT', 409);
    }

    const check = await this.locations.check(
      companyId,
      user.isFlexibleLocation === true,
      input.latitude,
      input.longitude,
    );
    const radiusPayload = {
      location_name: check.locationName,
      distance_meters: check.distanceMeters !== null ? Math.round(check.distanceMeters * 100) / 100 : null,
      allowed_radius_meters: check.radiusMeters,
      flexible_location: check.flexible,
    };
    if (!check.ok) {
      await this.processLog.fail(flowId, 'radius_validation', 'LOCATION_OUT_OF_RADIUS', radiusPayload);
      throw err('LOCATION_OUT_OF_RADIUS', 400);
    }
    await this.processLog.succeed(flowId, 'radius_validation', radiusPayload);

    // face verify (recognition mode)
    let tipe = input.tipe ?? row.tipe ?? 'selfie';
    const settings = await c.companySetting.findFirst({ where: { companyId } });
    if (settings?.tipeAbsen === 'recognition') {
      const faceRow = await c.faceRecognition.findFirst({ where: { companyId, userId } });
      if (!faceRow) throw err('FACE_NOT_REGISTERED', 400);
      if (!input.img) throw err('PHOTO_REQUIRED', 400);
      try {
        const result = await this.face.verify(faceRow.photoPath, input.img);
        if (!result.matched) throw err('FACE_VERIFY_FAILED', 400);
        tipe = 'recognition';
      } catch (e: any) {
        const code = typeof e?.errorCode === 'string' ? e.errorCode : 'FACE_VERIFY_FAILED';
        if (code !== 'FACE_VERIFY_FAILED') {
          await this.processLog.fail(flowId, 'face_recognition', code);
        }
        throw e;
      }
    }

    let photoName: string | null = null;
    if (input.img) {
      try {
        photoName = await this.photos.upload(input.img, userId, 'pulang');
      } catch (e) {
        await this.processLog.fail(flowId, 'photo', 'PHOTO_UPLOAD_FAILED');
        throw e;
      }
    }

    const statusPulang =
      row.scheduleTimeOut && time < normalizeTimeInput(row.scheduleTimeOut)
        ? 'PULANG_CEPAT'
        : null;

    try {
      const updated = await c.attendances.update({
        where: { id: row.id },
        data: {
          checkOut: time,
          photoOut: photoName,
          latitudeOut: input.latitude,
          longitudeOut: input.longitude,
          locationIdOut: check.locationId && check.locationId > 0 ? check.locationId : null,
          statusPulang,
          tipe,
        },
      });
      await this.processLog.succeed(flowId, 'attendance_persistence', { absen_id: updated.id });
      return {
        persisted: true,
        absen_id: updated.id,
        check_out: updated.checkOut,
        status_pulang: updated.statusPulang,
        message_key: 'SUCCESS',
      };
    } catch (e) {
      if (photoName) await this.photos.cleanup(photoName);
      await this.processLog.fail(flowId, 'attendance_persistence', 'SERVER_ERROR');
      throw err('SERVER_ERROR', 500);
    }
  }

  // ---------- today status ----------

  async today(user: any): Promise<any> {
    const companyId = user.companyId!;
    const dateIso = todayIso();
    const c = this.c();
    const row = await c.attendances.findFirst({
      where: { companyId, userId: user.id, tanggal: new Date(dateIso) },
    });
    const schedule = await this.getUserWorkSchedule(user.id, dateIso, 0);

    const scheduleIn = schedule ? schedule.timeIn.slice(0, 5) : null;
    const scheduleOut = schedule ? schedule.timeOut.slice(0, 5) : null;

    if (!row) {
      return {
        date: dateIso,
        checked_in: false,
        checked_out: false,
        can_check_in: true,
        can_check_out: false,
        attendance: {
          absen_id: null,
          absen_in: '00:00:00',
          absen_out: '00:00:00',
          check_in_time: null,
          check_out_time: null,
          status_masuk: null,
          status_pulang: null,
          kehadiran: null,
          jam_kerja_in: scheduleIn,
          jam_kerja_out: scheduleOut,
          tipe: null,
          foto_in: null,
          foto_out: null,
        },
      };
    }

    const checkedIn = !isSentinelTime(row.checkIn);
    const checkedOut = !isSentinelTime(row.checkOut);

    let jamKerjaIn = row.scheduleTimeIn ? row.scheduleTimeIn.slice(0, 5) : null;
    let jamKerjaOut = row.scheduleTimeOut ? row.scheduleTimeOut.slice(0, 5) : null;
    if (!jamKerjaIn || jamKerjaIn === '00:00') jamKerjaIn = scheduleIn;
    if (!jamKerjaOut || jamKerjaOut === '00:00') jamKerjaOut = scheduleOut;

    return {
      date: dateIso,
      checked_in: checkedIn,
      checked_out: checkedOut,
      can_check_in: !checkedIn,
      can_check_out: checkedIn && !checkedOut,
      attendance: {
        absen_id: row.id,
        absen_in: row.checkIn ?? '00:00:00',
        absen_out: row.checkOut ?? '00:00:00',
        check_in_time: isSentinelTime(row.checkIn) ? null : row.checkIn,
        check_out_time: isSentinelTime(row.checkOut) ? null : row.checkOut,
        status_masuk: row.statusMasuk,
        status_pulang: row.statusPulang,
        kehadiran: row.kehadiran,
        jam_kerja_in: jamKerjaIn,
        jam_kerja_out: jamKerjaOut,
        tipe: row.tipe,
        foto_in: row.photoIn,
        foto_out: row.photoOut,
        latitude_in: row.latitudeIn !== null ? Number(row.latitudeIn) : null,
        longitude_in: row.longitudeIn !== null ? Number(row.longitudeIn) : null,
        latitude_out: row.latitudeOut !== null ? Number(row.latitudeOut) : null,
        longitude_out: row.longitudeOut !== null ? Number(row.longitudeOut) : null,
      },
    };
  }

  // ---------- history ----------

  async history(user: any, limit = 30, offset = 0) {
    const companyId = user.companyId!;
    const lim = Math.min(Math.max(Number(limit) || 30, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);
    const c = this.c();
    const [total, rows] = await Promise.all([
      c.attendances.count({ where: { companyId, userId: user.id } }),
      c.attendances.findMany({
        where: { companyId, userId: user.id },
        orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
        take: lim,
        skip: off,
      }),
    ]);
    const records = await Promise.all(
      rows.map(async (r: any) => {
        const iso = todayIso(new Date(r.tanggal));
        const locIn = r.locationIdIn
          ? await c.location.findFirst({ where: { id: r.locationIdIn } }).catch(() => null)
          : null;
        const locOut = r.locationIdOut
          ? await c.location.findFirst({ where: { id: r.locationIdOut } }).catch(() => null)
          : null;
        const latIn = r.latitudeIn !== null ? Number(r.latitudeIn) : null;
        const lonIn = r.longitudeIn !== null ? Number(r.longitudeIn) : null;
        const latOut = r.latitudeOut !== null ? Number(r.latitudeOut) : null;
        const lonOut = r.longitudeOut !== null ? Number(r.longitudeOut) : null;
        const nameIn = locIn
          ? locIn.name
          : latIn !== null
            ? await this.locations.getLocationName(companyId, latIn, lonIn)
            : null;
        const nameOut = locOut
          ? locOut.name
          : latOut !== null
            ? await this.locations.getLocationName(companyId, latOut, lonOut)
            : null;
        return {
          absen_id: r.id,
          tanggal: iso,
          date: iso,
          tanggal_ind: this.tanggalIndId(iso),
          absen_in: r.checkIn ?? '00:00:00',
          absen_out: r.checkOut ?? '00:00:00',
          check_in_time: isSentinelTime(r.checkIn) ? null : (r.checkIn ?? '').slice(0, 5),
          check_out_time: isSentinelTime(r.checkOut) ? null : (r.checkOut ?? '').slice(0, 5),
          status_masuk: r.statusMasuk,
          status_pulang: r.statusPulang,
          kehadiran: r.kehadiran,
          tipe: r.tipe,
          foto_in: r.photoIn,
          foto_out: r.photoOut,
          nama_lokasi: nameOut ?? nameIn ?? '-',
          nama_lokasi_in: nameIn,
          nama_lokasi_out: nameOut,
        };
      }),
    );
    return { limit: lim, offset: off, total, records };
  }

  private tanggalIndId(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    return `${days[dt.getDay()]}, ${d} ${months[m - 1]} ${y}`;
  }

  // ---------- used by approval side effects ----------

  async createLeavePresenceRows(
    companyId: number,
    userId: number,
    startIso: string,
    endIso: string,
    kehadiran: 'CUTI' | 'IZIN',
    label: string,
  ): Promise<void> {
    const c = this.c();
    for (const day of dateRange(startIso, endIso)) {
      const existing = await c.attendances.findFirst({
        where: { companyId, userId, tanggal: new Date(day) },
      });
      if (existing) continue;
      await c.attendances.create({
        data: {
          companyId,
          userId,
          tanggal: new Date(day),
          checkIn: null,
          checkOut: null,
          statusMasuk: label,
          statusPulang: null,
          kehadiran,
          notes: label,
          tipe: label,
        },
      });
    }
  }
}
