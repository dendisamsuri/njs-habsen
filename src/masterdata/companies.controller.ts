import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Roles } from '../common/roles.guard';
import { Public } from '../common/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { err } from '../common/exceptions';

const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,29}$/;

class CompanyDto {
  @Matches(CODE_RE) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'active', 'inactive']) status?: string;
}

@Roles('PLATFORM_ADMIN')
@Controller('admin/companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.company.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      company_id: r.id,
      code: r.code,
      company_code: r.code,
      name: r.name,
      company_nama: r.name,
      status: r.status,
      created_at: r.createdAt,
    }));
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) throw err('COMPANY_NOT_FOUND', 404);
    return row;
  }

  @Post()
  async create(@Body() dto: CompanyDto) {
    const code = dto.code.toUpperCase();
    const dup = await this.prisma.company.findFirst({
      where: { OR: [{ code }, { name: dto.name }] },
    });
    if (dup) throw err('DUPLICATE', 409);
    const company = await this.prisma.company.create({
      data: {
        code,
        name: dto.name,
        status: (dto.status ?? 'ACTIVE').toUpperCase() as any,
      },
    });
    await this.prisma.companySetting.create({
      data: { companyId: company.id },
    });
    return company;
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CompanyDto>) {
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) throw err('COMPANY_NOT_FOUND', 404);
    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.status !== undefined ? { status: dto.status.toUpperCase() as any } : {}),
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) throw err('COMPANY_NOT_FOUND', 404);
    const users = await this.prisma.user.count({ where: { companyId: id, deletedAt: null } });
    if (users > 0) throw err('DUPLICATE', 409);
    await this.prisma.company.delete({ where: { id } });
    return true;
  }
}
