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
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Roles } from '../common/roles.guard';
import { UsersService } from './users.service';
import { err } from '../common/exceptions';

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() nama_lengkap!: string;
  @IsOptional() nip?: string;
  @IsOptional() role?: string;
  @IsOptional() direct_lead_id?: number;
  @IsOptional() position_id?: number;
  @IsOptional() location_id?: number;
  @IsOptional() schedule_id?: number;
  @IsOptional() phone?: string;
  @IsOptional() is_flexible_location?: boolean;
  @IsOptional() allow_replacement_off?: boolean;
  @IsOptional() allow_schedule_selection?: boolean;
  @IsOptional() allow_multiple_checkout?: boolean;
  @IsOptional() allow_half_day?: boolean;
  @IsOptional() allow_joint_leave?: boolean;
  @IsOptional() lang_pref?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() password_change?: string;
}

@Roles('PLATFORM_ADMIN', 'COMPANY_ADMIN')
@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  private companyId(req: any): number {
    if (!req.user?.companyId) throw err('FORBIDDEN', 403);
    return req.user.companyId;
  }

  @Get()
  list(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    this.companyId(req);
    return this.users.list({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      search,
      role,
    });
  }

  @Get('direct-reports')
  async directReports(@Req() req: any) {
    const cid = this.companyId(req);
    return this.users.getDirectReports(cid, req.user.id);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    this.companyId(req);
    const c = (this.users as any).client();
    const u = await c.user.findFirst({ where: { id, deletedAt: null } });
    if (!u || u.companyId !== req.user.companyId) throw err('USER_NOT_FOUND', 404);
    return this.users.toRecord(u);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    const cid = this.companyId(req);
    const { password_change, ...rest } = dto as any;
    return this.users.create(cid, { ...rest, password: password_change ?? dto.password });
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateUserDto) {
    this.companyId(req);
    return this.users.update(id, { ...(dto as any), password: (dto as any).password_change });
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    this.companyId(req);
    return this.users.remove(id);
  }
}
