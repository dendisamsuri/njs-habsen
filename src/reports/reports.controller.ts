import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ReportsService, ReportScope } from './reports.service';
import { Roles } from '../common/roles.guard';
import { err } from '../common/exceptions';

class CorrectDto {
  @IsInt() absen_id!: number;
  @IsOptional() @IsString() absen_in?: string | null;
  @IsOptional() @IsString() absen_out?: string | null;
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
  @IsOptional() @IsString() source?: string;
}

function scopeOf(req: any): ReportScope {
  if (!req.user?.companyId) throw err('FORBIDDEN', 403);
  return {
    companyId: req.user.companyId,
    supervisorUserId: req.user.role === 'SUPERVISOR' ? req.user.id : null,
  };
}

function num(v?: string): number | undefined {
  return v !== undefined && v !== '' ? Number(v) : undefined;
}

@Roles('PLATFORM_ADMIN', 'COMPANY_ADMIN', 'SUPERVISOR')
@Controller('admin')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/filters')
  filters(@Req() req: any) {
    return this.reports.filters(scopeOf(req));
  }

  @Get('reports/hari')
  async hari(
    @Req() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('lokasi_id') lokasiId?: string,
    @Query('posisi_id') posisiId?: string,
    @Query('user_id') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const scope = scopeOf(req);
    let start = startDate;
    let end = endDate;
    if (!start || !end) {
      const range = await this.reports.monthRange(Number(month ?? new Date().getMonth() + 1), Number(year ?? new Date().getFullYear()));
      start = range.start;
      end = range.end;
    }
    const report = await this.reports.matrix(scope, {
      start_date: start,
      end_date: end,
      lokasi_id: num(lokasiId),
      posisi_id: num(posisiId),
      user_id: num(userId),
      page: num(page),
      limit: num(limit),
    });
    const filters = await this.reports.filters(scope);
    return { filters, report };
  }

  @Get('reports/tanggal')
  async tanggal(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('lokasi_id') lokasiId?: string,
    @Query('posisi_id') posisiId?: string,
    @Query('user_id') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!startDate || !endDate) throw err('INVALID_DATE_FORMAT', 400);
    const scope = scopeOf(req);
    const report = await this.reports.matrix(scope, {
      start_date: startDate,
      end_date: endDate,
      lokasi_id: num(lokasiId),
      posisi_id: num(posisiId),
      user_id: num(userId),
      page: num(page),
      limit: num(limit),
    });
    const filters = await this.reports.filters(scope);
    return { filters, report };
  }

  @Get('reports/hari-ini')
  async hariIni(
    @Req() req: any,
    @Query('tanggal') tanggal?: string,
    @Query('lokasi_id') lokasiId?: string,
    @Query('posisi_id') posisiId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const t = tanggal ?? new Date().toISOString().slice(0, 10);
    const scope = scopeOf(req);
    const report = await this.reports.hariIni(scope, {
      tanggal: t,
      lokasi_id: num(lokasiId),
      posisi_id: num(posisiId),
      page: num(page),
      limit: num(limit),
    });
    const filters = await this.reports.filters(scope);
    return { filters, report };
  }

  @Get('reports/pegawai')
  pegawai(
    @Req() req: any,
    @Query('employee_id') employeeId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    if (!employeeId) throw err('VALIDATION_ERROR', 400);
    return this.reports.pegawai(scopeOf(req), {
      employee_id: Number(employeeId),
      month: Number(month ?? new Date().getMonth() + 1),
      year: Number(year ?? new Date().getFullYear()),
    });
  }

  @Get('attendance/process-log')
  processLog(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('employee_id') employeeId?: string,
    @Query('search') search?: string,
    @Query('attendance_type') attendanceType?: string,
    @Query('final_status') finalStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('flow_id') flowId?: string,
  ) {
    return this.reports.processLog(scopeOf(req), {
      date: date ?? new Date().toISOString().slice(0, 10),
      employee_id: num(employeeId),
      search,
      attendance_type: attendanceType,
      final_status: finalStatus,
      page: num(page),
      limit: num(limit),
      action,
      flow_id: flowId,
    });
  }

  @Post('attendance/correct')
  @HttpCode(200)
  correct(@Req() req: any, @Body() dto: CorrectDto) {
    return this.reports.correctAttendance(scopeOf(req), req.user.id, {
      ...dto,
      absen_in: dto.absen_in === undefined ? undefined : dto.absen_in === null || dto.absen_in === '' ? null : dto.absen_in,
      absen_out: dto.absen_out === undefined ? undefined : dto.absen_out === null || dto.absen_out === '' ? null : dto.absen_out,
    });
  }

  @Get('attendance/check')
  check(
    @Req() req: any,
    @Query('nip') nip?: string,
    @Query('user_id') userId?: string,
    @Query('tanggal') tanggal?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.checkAbsen(scopeOf(req), {
      nip,
      user_id: num(userId),
      tanggal,
      start_date: startDate,
      end_date: endDate,
      limit: num(limit),
    });
  }
}
