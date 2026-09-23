import { Global, Module, Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { REQUEST_CONTEXT, RequestContextService } from '../common/request-context';

export class PrismaService extends PrismaClient {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
}

const TENANT_MODELS = new Set<string>([
  'user',
  'position',
  'location',
  'holiday',
  'schedule',
  'leaveType',
  'companySetting',
  'attendances',
  'attendanceProcessLog',
  'attendanceCorrectionAudit',
  'leaveRequest',
  'replacementOff',
  'requestApproval',
  'leaveBalance',
  'notification',
  'faceRecognition',
]);

function tenantWhere(companyId: number | undefined, where: any): any {
  if (companyId === undefined) return where;
  if (where === undefined || where === null) return { companyId };
  if (Array.isArray(where)) return where;
  return { ...where, companyId };
}

@Injectable()
export class TenantPrismaService extends PrismaService {
  constructor(private readonly rcs: RequestContextService) {
    super();
  }

  private get companyId(): number | undefined {
    return this.rcs.companyId;
  }

  /** Tenant-scoped model proxy: injects companyId into where/create/connect. */
  scoped() {
    const companyId = this.companyId;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const root = this;
    const getBase = (prop: string) => (root as any)[prop];
    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          const base = getBase(prop as string);
          if (!base || typeof base !== 'object') return base;
          if (!TENANT_MODELS.has(prop)) return base;
          if (companyId === undefined) return base;

          return new Proxy(base, {
            get(model, op: string) {
              const val = (model as any)[op];
              if (typeof val !== 'function') return val;
              return (...args: any[]) => {
                const [a1, ...rest] = args;
                switch (op) {
                  case 'findUnique':
                  case 'findUniqueOrThrow':
                  case 'findFirst':
                  case 'findFirstOrThrow':
                  case 'findMany':
                  case 'delete':
                  case 'deleteMany':
                  case 'count':
                  case 'aggregate':
                  case 'update':
                  case 'updateMany': {
                    const a = a1 ?? {};
                    if (op.startsWith('find') || op === 'count' || op === 'aggregate') {
                      return val.call(model, { ...a, where: tenantWhere(companyId, a.where) }, ...rest);
                    }
                    if (op === 'delete' || op === 'update') {
                      return val.call(model, { ...a, where: tenantWhere(companyId, a.where) }, ...rest);
                    }
                    return val.call(model, { ...a, where: tenantWhere(companyId, a.where) }, ...rest);
                  }
                  case 'create': {
                    const a = a1 ?? {};
                    const data = a.data ?? {};
                    if (data.companyId === undefined && data.company === undefined) {
                      data.companyId = companyId;
                    } else if (data.company === undefined && typeof data.companyId === 'number' && data.companyId !== companyId) {
                      // cross-tenant create attempt — reject
                      throw new Error('CROSS_TENANT_CREATE');
                    }
                    return val.call(model, { ...a, data }, ...rest);
                  }
                  case 'createMany': {
                    const a = a1 ?? {};
                    const data = Array.isArray(a.data)
                      ? a.data.map((d: any) =>
                          d.companyId === undefined && d.company === undefined
                            ? { ...d, companyId }
                            : d,
                        )
                      : a.data;
                    return val.call(model, { ...a, data }, ...rest);
                  }
                  default:
                    return val.apply(model, args);
                }
              };
            },
          });
        },
      },
    );
  }
}

@Global()
@Module({
  providers: [PrismaService, TenantPrismaService],
  exports: [PrismaService, TenantPrismaService],
})
export class PrismaModule {}
