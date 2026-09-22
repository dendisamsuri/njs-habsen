import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../common/jwt-auth.guard';

class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: any) {
    const ip = req.ip ?? 'unknown';
    return this.auth.refresh(dto.refresh_token, ip);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: any) {
    await this.auth.logout(req.user.id);
    return true;
  }
}
