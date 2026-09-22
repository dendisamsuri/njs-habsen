import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ThrottleService } from './throttle.service';
import { err } from '../common/exceptions';
import { AccessTokenPayload } from '../common/jwt-auth.guard';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly throttle: ThrottleService,
  ) {}

  private accessTtl() {
    return Number(process.env.JWT_ACCESS_TTL ?? 3600);
  }

  private refreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'change-me-refresh-secret';
  }

  private refreshTtl() {
    return Number(process.env.JWT_REFRESH_TTL ?? 604800);
  }

  async login(email: string, password: string, ip: string) {
    const blocked = this.throttle.isBlocked(email, ip);
    if (blocked > 0) throw err('LOGIN_THROTTLE', 429);

    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
    });
    if (!user || !user.isActive) {
      this.throttle.recordFailure(email, ip);
      await this.prisma.loginAttempt.create({
        data: { email: email.toLowerCase().trim(), ip, success: false },
      });
      throw err('INVALID_CREDENTIALS', 401);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      this.throttle.recordFailure(email, ip);
      await this.prisma.loginAttempt.create({
        data: { email: email.toLowerCase().trim(), ip, success: false },
      });
      throw err('INVALID_CREDENTIALS', 401);
    }

    this.throttle.clear(email, ip);
    await this.prisma.loginAttempt.create({
      data: { email: user.email, ip, success: true },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.companyId, user.jwtVersion);
    return {
      ...tokens,
      expires_in: this.accessTtl(),
      user: {
        id: user.id,
        user_id: user.id,
        email: user.email,
        nama_lengkap: user.namaLengkap,
        nip: user.nip,
        role: user.role,
        company_id: user.companyId,
        lokasi_id: user.locationId,
        posisi_id: user.positionId,
        schedule_id: user.scheduleId,
        direct_lead_id: user.directLeadId,
        lang_pref: user.langPref,
        face_registered: user.faceRegistered,
        is_flexible_location: user.isFlexibleLocation,
        allow_schedule_selection: user.allowScheduleSelection,
        allow_multiple_checkout: user.allowMultipleCheckout,
        allow_replacement_off: user.allowReplacementOff,
        allow_half_day: user.allowHalfDay,
        allow_joint_leave: user.allowJointLeave,
      },
    };
  }

  private async issueTokens(
    userId: number,
    email: string,
    role: string,
    companyId: number | null,
    jwtVersion: number,
  ) {
    const payload: AccessTokenPayload = {
      sub: userId,
      email,
      role,
      companyId,
      jwtVersion,
      issuedFor: 'employee_api',
    };
    const token = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: this.accessTtl(),
    });
    const refreshPayload = {
      sub: userId,
      jwtVersion,
      issuedFor: 'employee_api_refresh',
      jti: randomBytes(16).toString('hex'),
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.refreshSecret(),
      expiresIn: this.refreshTtl(),
    });
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(refreshPayload.jti).digest('hex'),
        expiresAt: new Date(Date.now() + this.refreshTtl() * 1000),
      },
    });
    return { token, refresh_token: refreshToken };
  }

  async refresh(refreshToken: string, ip: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw err('REFRESH_INVALID', 401);
    }
    if (payload.issuedFor !== 'employee_api_refresh') throw err('REFRESH_INVALID', 401);

    const jtiHash = createHash('sha256').update(payload.jti).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: jtiHash },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw err('REFRESH_INVALID', 401);
    }
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
    });
    if (!user || user.jwtVersion !== payload.jwtVersion) throw err('REFRESH_INVALID', 401);

    // rotation: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueTokens(user.id, user.email, user.role, user.companyId, user.jwtVersion);
    return { ...tokens, expires_in: this.accessTtl() };
  }

  async logout(userId: number) {
    // revoke all refresh tokens + bump jwt_version (kills access tokens)
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { jwtVersion: { increment: 1 } },
      }),
    ]);
    return true;
  }
}
