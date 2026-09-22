import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TenantPrismaService } from '../prisma/prisma.module';

export type ProcessStage =
  | 'radius_validation'
  | 'face_recognition'
  | 'photo'
  | 'attendance_persistence'
  | 'server_validation';

@Injectable()
export class ProcessLogService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  async start(companyId: number, userId: number, stage: ProcessStage = 'server_validation'): Promise<string> {
    const flowId = randomUUID();
    try {
      await this.c().attendanceProcessLog.create({
        data: {
          companyId,
          flowId,
          userId,
          stage,
          status: 'PENDING',
          events: { create: { stage, status: 'PENDING', message: 'started' } },
        },
      });
    } catch {
      // logging must never break attendance
    }
    return flowId;
  }

  async event(
    flowId: string,
    stage: ProcessStage | string,
    status: 'PENDING' | 'SUCCESS' | 'FAILED',
    message?: string,
    payload?: unknown,
  ) {
    try {
      await this.prisma.attendanceProcessEvent.create({
        data: { flowId, stage, status, message: message ?? null, payload: (payload as any) ?? undefined },
      });
      await this.prisma.attendanceProcessLog.update({
        where: { flowId },
        data: { stage, status: status === 'SUCCESS' ? 'SUCCESS' : status === 'FAILED' ? 'FAILED' : 'PENDING' },
      });
    } catch {
      // swallow
    }
  }

  async fail(flowId: string, stage: ProcessStage | string, message: string, payload?: unknown) {
    await this.event(flowId, stage, 'FAILED', message, payload);
  }

  async succeed(flowId: string, stage: ProcessStage | string, payload?: unknown) {
    await this.event(flowId, stage, 'SUCCESS', undefined, payload);
  }
}
