import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, Max, IsIn } from 'class-validator';
import { Roles } from '../common/roles.guard';
import { TenantPrismaService } from '../prisma/prisma.module';
import { err } from '../common/exceptions';

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class CodeNameDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

class LocationDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsNotEmpty() latitude!: any;
  @IsNotEmpty() longitude!: any;
  @IsOptional() radius_meters?: number;
  @IsOptional() @IsIn(['Y', 'N']) status?: 'Y' | 'N';
  @IsOptional() @IsBoolean() is_flexible?: boolean;
}

class ScheduleDetailDto {
  @IsIn(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as any)
  day_of_week!: any;
  @Matches(TIME_RE) time_in!: string;
  @Matches(TIME_RE) time_out!: string;
  @IsOptional() @IsInt() @Min(0) tolerance_minutes?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

class ScheduleDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() details?: ScheduleDetailDto[];
}

class LeaveTypeDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsIn(['LEAVE', 'PERMIT', 'SICK']) category?: any;
  @IsOptional() @IsBoolean() is_deductible?: boolean;
  @IsOptional() @IsBoolean() requires_attachment?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

class HolidayDto {
  @Matches(DATE_RE) tanggal!: string;
  @IsString() @IsNotEmpty() @Max(160) name!: string;
}

class CompanySettingDto {
  @IsOptional() timezone?: string;
  @IsOptional() @IsIn(['selfie', 'recognition']) tipe_absen?: string;
  @IsOptional() @IsBoolean() require_hr_final?: boolean;
}

@Roles('PLATFORM_ADMIN', 'COMPANY_ADMIN')
@Controller('admin')
export class MasterdataController {
  constructor(private readonly prisma: TenantPrismaService) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  private cid(req: any): number {
    if (!req.user?.companyId) throw err('FORBIDDEN', 403);
    return req.user.companyId;
  }

  // ---- positions ----
  @Get('positions')
  async positions(@Req() req: any, @Query('q') q?: string) {
    const where: any = { companyId: this.cid(req) };
    if (q) where.name = { contains: q };
    const rows = await this.c().position.findMany({ where, orderBy: { name: 'asc' } });
    return rows.map((r: any) => ({
      id: r.id,
      position_id: r.id,
      code: r.code,
      name: r.name,
      posisi_nama: r.name,
      is_active: r.isActive,
    }));
  }

  @Post('positions')
  createPosition(@Req() req: any, @Body() dto: CodeNameDto) {
    return this.c()
      .position.create({
        data: {
          companyId: this.cid(req),
          code: dto.code,
          name: dto.name,
          isActive: dto.is_active ?? true,
        },
      })
      .catch((e: any) => {
        if (String(e?.message).includes('UNIQUE')) throw err('DUPLICATE', 409);
        throw e;
      });
  }

  @Patch('positions/:id')
  async updatePosition(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CodeNameDto>) {
    const row = await this.c().position.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('POSITION_NOT_FOUND', 404);
    return this.c().position.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
      },
    });
  }

  @Delete('positions/:id')
  async deletePosition(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const c = this.c();
    const row = await c.position.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('POSITION_NOT_FOUND', 404);
    const used = await c.user.count({ where: { positionId: id } });
    if (used > 0) throw err('DUPLICATE', 409);
    await c.position.delete({ where: { id } });
    return true;
  }

  // ---- locations ----
  @Get('locations')
  async locations(@Req() req: any) {
    const rows = await this.c().location.findMany({
      where: { companyId: this.cid(req) },
      orderBy: { name: 'asc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      lokasi_id: r.id,
      code: r.code,
      name: r.name,
      lokasi_nama: r.name,
      latitude: Number(r.latitude),
      lokasi_latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      lokasi_longitude: Number(r.longitude),
      radius_meters: r.radiusMeters,
      lokasi_radius: r.radiusMeters,
      status: r.status,
      lokasi_status: r.status,
      is_flexible: r.isFlexible,
    }));
  }

  @Post('locations')
  async createLocation(@Req() req: any, @Body() dto: LocationDto) {
    const lat = Number(dto.latitude);
    const lon = Number(dto.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw err('COORDINATES_INVALID', 400);
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw err('COORDINATES_INVALID', 400);
    const radius = Number(dto.radius_meters ?? 100);
    if (!Number.isInteger(radius) || radius < 1) throw err('VALIDATION_ERROR', 400);
    const c = this.c();
    const dup = await c.location.findFirst({
      where: { companyId: this.cid(req), OR: [{ code: dto.code }, { name: dto.name }] },
    });
    if (dup) throw err('DUPLICATE', 409);
    return c.location.create({
      data: {
        companyId: this.cid(req),
        code: dto.code,
        name: dto.name,
        latitude: lat,
        longitude: lon,
        radiusMeters: radius,
        status: dto.status ?? 'Y',
        isFlexible: dto.is_flexible ?? false,
      },
    });
  }

  @Patch('locations/:id')
  async updateLocation(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: Partial<LocationDto>) {
    const c = this.c();
    const row = await c.location.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('LOCATION_NOT_FOUND', 404);
    const data: any = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.latitude !== undefined) {
      const lat = Number(dto.latitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw err('COORDINATES_INVALID', 400);
      data.latitude = lat;
    }
    if (dto.longitude !== undefined) {
      const lon = Number(dto.longitude);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw err('COORDINATES_INVALID', 400);
      data.longitude = lon;
    }
    if (dto.radius_meters !== undefined) {
      const radius = Number(dto.radius_meters);
      if (!Number.isInteger(radius) || radius < 1) throw err('VALIDATION_ERROR', 400);
      data.radiusMeters = radius;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.is_flexible !== undefined) data.isFlexible = dto.is_flexible;
    return c.location.update({ where: { id }, data });
  }

  @Delete('locations/:id')
  async deleteLocation(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const c = this.c();
    const row = await c.location.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('LOCATION_NOT_FOUND', 404);
    const used = await c.user.count({ where: { locationId: id } });
    if (used > 0) throw err('DUPLICATE', 409);
    await c.location.delete({ where: { id } });
    return true;
  }

  // ---- schedules ----
  @Get('schedules')
  async schedules(@Req() req: any) {
    const rows = await this.c().schedule.findMany({
      where: { companyId: this.cid(req) },
      include: { details: { orderBy: { dayOfWeek: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((s: any) => this.scheduleRecord(s));
  }

  scheduleRecord(s: any) {
    return {
      id: s.id,
      schedule_id: s.id,
      code: s.code,
      name: s.name,
      is_active: s.isActive,
      details: (s.details ?? []).map((d: any) => ({
        id: d.id,
        schedule_detail_id: d.id,
        day_of_week: d.dayOfWeek,
        time_in: d.timeIn,
        time_out: d.timeOut,
        tolerance_minutes: d.toleranceMinutes,
        is_active: d.isActive,
      })),
    };
  }

  @Get('schedules/:id')
  async schedule(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const row = await this.c().schedule.findFirst({
      where: { id, companyId: this.cid(req) },
      include: { details: true },
    });
    if (!row) throw err('SCHEDULE_NOT_FOUND', 404);
    return this.scheduleRecord(row);
  }

  @Post('schedules')
  async createSchedule(@Req() req: any, @Body() dto: ScheduleDto) {
    const c = this.c();
    try {
      return await c.schedule.create({
        data: {
          companyId: this.cid(req),
          code: dto.code,
          name: dto.name,
          isActive: dto.is_active ?? true,
          details: dto.details
            ? {
                create: dto.details.map((d) => ({
                  dayOfWeek: d.day_of_week,
                  timeIn: d.time_in.length === 5 ? `${d.time_in}:00` : d.time_in,
                  timeOut: d.time_out.length === 5 ? `${d.time_out}:00` : d.time_out,
                  toleranceMinutes: d.tolerance_minutes ?? 0,
                  isActive: d.is_active ?? true,
                })),
              }
            : undefined,
        },
        include: { details: true },
      });
    } catch (e: any) {
      if (String(e?.message).includes('UNIQUE')) throw err('DUPLICATE', 409);
      throw e;
    }
  }

  @Patch('schedules/:id')
  async updateSchedule(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: Partial<ScheduleDto>) {
    const c = this.c();
    const row = await c.schedule.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('SCHEDULE_NOT_FOUND', 404);
    if (dto.details) {
      await c.scheduleDetail.deleteMany({ where: { scheduleId: id } });
    }
    return c.schedule.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
        ...(dto.details
          ? {
              details: {
                create: dto.details.map((d) => ({
                  dayOfWeek: d.day_of_week,
                  timeIn: d.time_in.length === 5 ? `${d.time_in}:00` : d.time_in,
                  timeOut: d.time_out.length === 5 ? `${d.time_out}:00` : d.time_out,
                  toleranceMinutes: d.tolerance_minutes ?? 0,
                  isActive: d.is_active ?? true,
                })),
              },
            }
          : {}),
      },
      include: { details: true },
    });
  }

  @Delete('schedules/:id')
  async deleteSchedule(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const c = this.c();
    const row = await c.schedule.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('SCHEDULE_NOT_FOUND', 404);
    const used = await c.user.count({ where: { scheduleId: id } });
    if (used > 0) throw err('DUPLICATE', 409);
    await c.schedule.delete({ where: { id } });
    return true;
  }

  // ---- leave types ----
  @Get('leave-types')
  async leaveTypes(@Req() req: any) {
    const rows = await this.c().leaveType.findMany({
      where: { companyId: this.cid(req) },
      orderBy: { name: 'asc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      leave_type_id: r.id,
      code: r.code,
      name: r.name,
      jenis: r.name,
      category: r.category,
      is_deductible: r.isDeductible,
      requires_attachment: r.requiresAttachment,
      is_active: r.isActive,
    }));
  }

  @Post('leave-types')
  async createLeaveType(@Req() req: any, @Body() dto: LeaveTypeDto) {
    const c = this.c();
    try {
      return await c.leaveType.create({
        data: {
          companyId: this.cid(req),
          code: dto.code,
          name: dto.name,
          category: (dto.category as any) ?? 'LEAVE',
          isDeductible: dto.is_deductible ?? true,
          requiresAttachment: dto.requires_attachment ?? false,
          isActive: dto.is_active ?? true,
        },
      });
    } catch (e: any) {
      if (String(e?.message).includes('UNIQUE')) throw err('DUPLICATE', 409);
      throw e;
    }
  }

  @Patch('leave-types/:id')
  async updateLeaveType(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: Partial<LeaveTypeDto>) {
    const c = this.c();
    const row = await c.leaveType.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('LEAVE_TYPE_NOT_FOUND', 404);
    return c.leaveType.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category as any } : {}),
        ...(dto.is_deductible !== undefined ? { isDeductible: dto.is_deductible } : {}),
        ...(dto.requires_attachment !== undefined ? { requiresAttachment: dto.requires_attachment } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
      },
    });
  }

  @Delete('leave-types/:id')
  async deleteLeaveType(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const c = this.c();
    const row = await c.leaveType.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('LEAVE_TYPE_NOT_FOUND', 404);
    const used = await c.leaveRequest.count({ where: { leaveTypeId: id } });
    if (used > 0) throw err('DUPLICATE', 409);
    await c.leaveType.delete({ where: { id } });
    return true;
  }

  // ---- holidays ----
  @Get('holidays')
  async holidays(@Req() req: any) {
    const rows = await this.c().holiday.findMany({
      where: { companyId: this.cid(req) },
      orderBy: { date: 'asc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      tanggal: r.date.toISOString().slice(0, 10),
      name: r.name,
      keterangan: r.name,
    }));
  }

  @Post('holidays')
  async createHoliday(@Req() req: any, @Body() dto: HolidayDto) {
    const c = this.c();
    try {
      return await c.holiday.create({
        data: { companyId: this.cid(req), date: new Date(dto.tanggal), name: dto.name },
      });
    } catch (e: any) {
      if (String(e?.message).includes('UNIQUE')) throw err('DUPLICATE', 409);
      throw e;
    }
  }

  @Patch('holidays/:id')
  async updateHoliday(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: Partial<HolidayDto>) {
    const c = this.c();
    const row = await c.holiday.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('HOLIDAY_NOT_FOUND', 404);
    return c.holiday.update({
      where: { id },
      data: {
        ...(dto.tanggal !== undefined ? { date: new Date(dto.tanggal) } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
    });
  }

  @Delete('holidays/:id')
  async deleteHoliday(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const c = this.c();
    const row = await c.holiday.findFirst({ where: { id, companyId: this.cid(req) } });
    if (!row) throw err('HOLIDAY_NOT_FOUND', 404);
    await c.holiday.delete({ where: { id } });
    return true;
  }

  // ---- company settings ----
  @Get('company-settings')
  async getSettings(@Req() req: any) {
    const cid = this.cid(req);
    const row = await this.c().companySetting.findFirst({ where: { companyId: cid } });
    if (!row) throw err('COMPANY_SETTINGS_NOT_FOUND', 404);
    return {
      timezone: row.timezone,
      tipe_absen: row.tipeAbsen,
      require_hr_final: row.requireHrFinal,
      date_format: row.dateFormat,
      extra: row.extra,
    };
  }

  @Patch('company-settings')
  async updateSettings(@Req() req: any, @Body() dto: CompanySettingDto) {
    const cid = this.cid(req);
    const c = this.c();
    const data: any = {};
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.tipe_absen !== undefined) data.tipeAbsen = dto.tipe_absen;
    if (dto.require_hr_final !== undefined) data.requireHrFinal = dto.require_hr_final;
    const existing = await c.companySetting.findFirst({ where: { companyId: cid } });
    if (existing) {
      return c.companySetting.update({ where: { companyId: cid }, data });
    }
    return c.companySetting.create({ data: { companyId: cid, ...data } });
  }
}
