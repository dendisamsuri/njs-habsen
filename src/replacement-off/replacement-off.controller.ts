import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ReplacementOffService } from './replacement-off.service';
import { Roles } from '../common/roles.guard';
import { err } from '../common/exceptions';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class SubmitDto {
  @IsInt() id!: number;
  @Matches(DATE_RE) replacement_date!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class AdminCreateDto {
  @IsOptional() @IsInt() company_id?: number;
  @IsInt() user_id!: number;
  @Matches(DATE_RE) original_date!: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsBoolean() is_half_day?: boolean;
  @IsOptional() @IsInt() expiry_days?: number;
  @IsOptional() @IsInt() schedule_id?: number;
}

// PLATFORM_ADMIN has no company: it must name one. Other roles stay pinned to their own.
function resolveCompanyId(req: any, picked?: number | string | null): number | null {
  if (req.user?.companyId != null) return req.user.companyId;
  const id = Number(picked);
  return Number.isInteger(id) && id > 0 ? id : null;
}

@Controller('replacement-off')
export class ReplacementOffController {
  constructor(private readonly service: ReplacementOffService) {}

  @Get()
  list(@Req() req: any, @Query('status') status?: string) {
    return this.service.list(req.user, status);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: SubmitDto) {
    return this.service.submit(req.user, id, dto.replacement_date, dto.note);
  }
}

@Roles('PLATFORM_ADMIN', 'COMPANY_ADMIN', 'SUPERVISOR')
@Controller('admin/replacement-off')
export class ReplacementOffAdminController {
  constructor(private readonly service: ReplacementOffService) {}

  @Get()
  adminList(@Req() req: any, @Query('status') status?: string, @Query('company_id') companyId?: string) {
    // company-wide listing bypasses employee allow_replacement_off gate
    return this.service.adminListCompany(
      resolveCompanyId(req, companyId),
      status,
      req.user.role === 'SUPERVISOR' ? req.user.id : null,
    );
  }

  @Roles('PLATFORM_ADMIN', 'COMPANY_ADMIN')
  @Post()
  @HttpCode(200)
  create(@Req() req: any, @Body() dto: AdminCreateDto) {
    const companyId = resolveCompanyId(req, dto.company_id);
    if (companyId == null) throw err('COMPANY_REQUIRED', 400);
    return this.service.adminCreate(companyId, dto, req.user.id);
  }
}
