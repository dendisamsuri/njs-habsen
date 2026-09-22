import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Req, Res } from '@nestjs/common';
import { IsNotEmpty, IsString, IsInt } from 'class-validator';
import { FaceService } from './face.service';
import { err } from '../common/exceptions';
import { Public } from '../common/jwt-auth.guard';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';

class FaceRegisterDto {
  @IsString() @IsNotEmpty() img!: string;
}

class FaceDeleteDto {
  @IsInt() recognition_id!: number;
}

@Controller('face')
export class FaceController {
  constructor(private readonly face: FaceService) {}

  @Get()
  status(@Req() req: any) {
    return this.face.status(req.user.companyId!, req.user.id);
  }

  @Post('register')
  async register(@Req() req: any, @Body() dto: FaceRegisterDto) {
    const data = await this.face.register(req.user.companyId!, req.user.id, dto.img);
    return { messageKey: 'SUCCESS', ...data, data };
  }

  @Post('delete')
  @HttpCode(200)
  async remove(@Req() req: any, @Body() dto: FaceDeleteDto) {
    if (dto.recognition_id < 1) throw err('VALIDATION_ERROR', 400);
    await this.face.remove(req.user.companyId!, req.user.id);
    return true;
  }

  /** Public: face photo for Image.network without Authorization. */
  @Public()
  @Get('photo/:id')
  async photo(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { abs } = await this.face.photoFile(id);
    if (!existsSync(abs)) throw err('NOT_FOUND', 404);
    res.setHeader('Content-Type', abs.endsWith('.png') ? 'image/png' : 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    createReadStream(abs).pipe(res);
  }
}
