import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ReplacementOffService } from './replacement-off.service';
import { Roles } from '../common/roles.guard';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class SubmitDto {
  @IsInt() id!: number;
  @Matches(DATE_RE) replacement_date!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class AdminCreateDto {
  @IsInt() user_id!: number;
  @Matches(DATE_RE) original_date!: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsBoolean() is_half_day?: boolean;
  @IsOptional() @IsInt() expiry_days?: number;
  @IsOptional() @IsInt() schedule_id?: number;
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
  async adminList(@Req() req: any, @Query('status') status?: string) {
    if (!req.user?.companyId) throw new Error('FORBIDDEN');
    // company-wide listing bypasses employee allow_replacement_off gate
    return (this.service as any).adminListCompany(
      req.user.companyId,
      status,
      req.user.role === 'SUPERVISOR' ? req.user.id : null,
    );
  }

  @Post()
  @HttpCode(200)
  create(@Req() req: any, @Body() dto: AdminCreateDto) {
    if (!req.user?.companyId) throw new Error('FORBIDDEN');
    return this.service.adminCreate(req.user.companyId, dto);
  }
}
