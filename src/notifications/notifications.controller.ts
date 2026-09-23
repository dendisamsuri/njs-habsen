import { Body, Controller, Get, HttpCode, Injectable, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TenantPrismaService } from '../prisma/prisma.module';
import { RequestContextService } from '../common/request-context';
import { err } from '../common/exceptions';
import { t } from '../i18n/messages';

class CreateNotificationDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() link?: string;
  @IsOptional() category?: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly rcs: RequestContextService,
  ) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('is_read') isRead?: string,
    @Query('category') category?: string,
  ) {
    const where: any = {
      OR: [
        { recipientType: 'USER', recipientId: req.user.id },
        { recipientType: 'ROLE', role: req.user.role },
      ],
    };
    if (isRead === 'true' || isRead === '1') where.isRead = true;
    if (isRead === 'false' || isRead === '0') where.isRead = false;
    if (category) where.category = category as any;
    const lim = Math.min(Math.max(Number(limit ?? 20), 1), 200);
    const off = Math.max(Number(offset ?? 0), 0);
    const c = this.c();
    const [total, unread, rows] = await Promise.all([
      c.notification.count({ where }),
      c.notification.count({ where: { ...where, isRead: false } }),
      c.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: lim, skip: off }),
    ]);
    return {
      limit: lim,
      offset: off,
      total,
      unread_count: unread,
      records: rows.map((n: any) => this.toRecord(n, this.rcs.locale)),
    };
  }

  toRecord(n: any, locale: 'id' | 'en' = 'id') {
    const title = n.titleKey ? t(n.titleKey, locale, n.bodyParams ?? undefined) : n.title;
    const body = n.bodyKey ? t(n.bodyKey, locale, n.bodyParams ?? undefined) : n.body;
    return {
      id: n.id,
      title,
      message: body,
      body,
      category: n.category,
      link: n.link,
      url: n.link,
      is_read: n.isRead,
      created_at: n.createdAt,
      event_key: n.eventKey,
      reference_id: null,
      actor_name: null,
      status: n.isRead ? 'Y' : 'N',
      notifikasi_id: n.id,
      keterangan: body,
    };
  }

  @Post('mark-read/:id')
  @HttpCode(200)
  async markRead(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const c = this.c();
    const row = await c.notification.findFirst({
      where: { id, OR: [{ recipientId: req.user.id, recipientType: 'USER' }] },
    });
    if (!row) throw err('NOTIFICATION_NOT_FOUND', 404);
    await c.notification.update({ where: { id }, data: { isRead: true } });
    return true;
  }

  @Post('mark-all-read')
  @HttpCode(200)
  async markAllRead(@Req() req: any) {
    const c = this.c();
    await c.notification.updateMany({
      where: { recipientType: 'USER', recipientId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    return true;
  }
}

/** Internal helper used by approval/leave services (not a controller route). */
@Injectable()
export class NotificationWriter {
  constructor(private readonly prisma: TenantPrismaService) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  async notifyUser(payload: {
    companyId: number;
    userId: number;
    category: string;
    eventKey: string;
    titleKey: string;
    bodyKey?: string;
    params?: Record<string, string | number>;
    link?: string;
  }) {
    try {
      await this.c().notification.upsert({
        where: { companyId_eventKey: { companyId: payload.companyId, eventKey: payload.eventKey } },
        update: {},
        create: {
          companyId: payload.companyId,
          recipientType: 'USER',
          recipientId: payload.userId,
          category: payload.category as any,
          eventKey: payload.eventKey,
          title: payload.titleKey,
          titleKey: payload.titleKey,
          bodyKey: payload.bodyKey ?? null,
          bodyParams: payload.params ? JSON.parse(JSON.stringify(payload.params)) : undefined,
          link: payload.link ?? null,
        },
      });
    } catch (e) {
      // notifications never break main flow
      console.error('notification write failed', e);
    }
  }

  async notifyRoles(payload: {
    companyId: number;
    roles: string[];
    category: string;
    eventKeyBase: string;
    titleKey: string;
    bodyKey?: string;
    params?: Record<string, string | number>;
    link?: string;
  }) {
    for (const role of payload.roles) {
      try {
        const eventKey = `${payload.eventKeyBase}:role:${role}`;
        await this.c().notification.upsert({
          where: { companyId_eventKey: { companyId: payload.companyId, eventKey } },
          update: {},
          create: {
            companyId: payload.companyId,
            recipientType: 'ROLE',
            role,
            category: payload.category as any,
            eventKey,
            title: payload.titleKey,
            titleKey: payload.titleKey,
            bodyKey: payload.bodyKey ?? null,
            bodyParams: payload.params ? JSON.parse(JSON.stringify(payload.params)) : undefined,
            link: payload.link ?? null,
          },
        });
      } catch (e) {
        console.error('notification write failed', e);
      }
    }
  }

  async notifyDirectLead(payload: {
    companyId: number;
    userId: number;
    category: string;
    eventKey: string;
    titleKey: string;
    bodyKey?: string;
    params?: Record<string, string | number>;
    link?: string;
  }) {
    try {
      const user = await this.c().user.findFirst({ where: { id: payload.userId } });
      if (user?.directLeadId) {
        await this.notifyUser({ ...payload, userId: user.directLeadId, eventKey: `${payload.eventKey}:lead` });
      }
    } catch (e) {
      console.error('notification write failed', e);
    }
  }
}
