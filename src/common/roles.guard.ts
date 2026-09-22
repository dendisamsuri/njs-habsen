import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { err } from './exceptions';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const roles =
      Reflect.getMetadata(ROLES_KEY, context.getHandler()) ??
      Reflect.getMetadata(ROLES_KEY, context.getClass());
    if (!roles || roles.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      throw err('FORBIDDEN', 403);
    }
    return true;
  }
}

export function Roles(...roles: string[]): MethodDecorator & ClassDecorator {
  return (target: object, key?: any, descriptor?: any) => {
    if (descriptor) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(ROLES_KEY, roles, target);
  };
}
