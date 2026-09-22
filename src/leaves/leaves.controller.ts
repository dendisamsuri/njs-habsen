import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LeavesService } from './leaves.service';
import { err } from '../common/exceptions';
import { Response, request } from 'express';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class LeaveDto {
  @IsInt() leave_type_id!: number;
  @Matches(DATE_RE) start_date!: string;
  @IsOptional() @Matches(DATE_RE) end_date?: string;
  @IsString() @MinLength(1) reason!: string;
  @IsOptional() @IsBoolean() is_half_day?: boolean;
  @IsOptional() @IsString() attachment?: string;
}

class CancelDto {
  @IsInt() id!: number;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

@Controller('leaves')
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Get('balance')
  balance(@Req() req: any) {
    return this.leaves.balance(req.user);
  }

  @Get()
  list(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.leaves.list(req.user, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
    });
  }

  @Get(':id')
  detail(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.leaves.detail(req.user, id);
  }

  @Post()
  @HttpCode(200)
  create(@Req() req: any, @Body() dto: LeaveDto) {
    return this.leaves.create(req.user, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: LeaveDto) {
    return this.leaves.update(req.user, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: CancelDto) {
    return this.leaves.cancel(req.user, id, dto.reason);
  }

  @Get(':id/attachment')
  async attachment(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const rel = await this.leaves.attachment(req.user, id);
    const abs = path.join(process.env.UPLOAD_DIR ?? 'uploads', rel);
    if (!existsSync(abs)) throw err('NOT_FOUND', 404);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline');
    createReadStream(abs).pipe(res);
  }
}
