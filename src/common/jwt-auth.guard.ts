import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AsyncLocalStorage } from 'async_hooks';
import { PrismaService } from '../prisma/prisma.service';
import { err } from './exceptions';
import { REQUEST_CONTEXT, RequestContext } from './request-context';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => {
  return ((target: any, key?: any, descriptor?: any) => {
    if (descriptor) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, true, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, target);
  }) as any;
};

export interface AccessTokenPayload {
  sub: number;
  email: string;
  role: string;
  companyId: number | null;
  jwtVersion: number;
  issuedFor: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    @Optional() @Inject(REQUEST_CONTEXT) private readonly als: AsyncLocalStorage<RequestContext>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header || !/^Bearer\s+/i.test(header)) {
      throw err('UNAUTHORIZED', 401);
    }
    const token = header.replace(/^Bearer\s+/i, '').trim();
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw err('TOKEN_EXPIRED', 401);
    }
    if (payload.issuedFor !== 'employee_api') {
      throw err('TOKEN_INVALID', 401);
    }
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
    });
    if (!user) throw err('UNAUTHORIZED', 401);
    if (user.jwtVersion !== payload.jwtVersion) throw err('TOKEN_INVALID', 401);

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      jwtVersion: user.jwtVersion,
      langPref: user.langPref,
      namaLengkap: user.namaLengkap,
      directLeadId: user.directLeadId,
      isFlexibleLocation: user.isFlexibleLocation,
      allowReplacementOff: user.allowReplacementOff,
      allowHalfDay: user.allowHalfDay,
      allowMultipleCheckout: user.allowMultipleCheckout,
      allowScheduleSelection: user.allowScheduleSelection,
      scheduleId: user.scheduleId,
      locationId: user.locationId,
      faceRegistered: user.faceRegistered,
      positionId: user.positionId,
    };

    const store = this.als?.getStore();
    if (store) {
      store.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        jwtVersion: user.jwtVersion,
        langPref: user.langPref,
      };
      if (user.companyId) store.companyId = user.companyId;
      if (user.langPref === 'en' || user.langPref === 'id') store.locale = user.langPref;
      req.locale = store.locale;
    }
    return true;
  }
}
