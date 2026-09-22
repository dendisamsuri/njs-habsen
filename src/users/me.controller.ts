import { Controller, Get, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { err } from '../common/exceptions';

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('profile')
  async profile(@Req() req: any) {
    const user = await this.prisma.user.findFirst({
      where: { id: req.user.id, deletedAt: null },
      include: {
        position: true,
        location: true,
        company: true,
        directLead: { select: { id: true, namaLengkap: true } },
      },
    });
    if (!user) throw err('USER_NOT_FOUND', 404);
    return {
      user_id: user.id,
      id: user.id,
      email: user.email,
      nip: user.nip,
      nama_lengkap: user.namaLengkap,
      name: user.namaLengkap,
      role: user.role,
      company_id: user.companyId,
      company_nama: user.company?.name ?? null,
      telp: user.phone,
      phone: user.phone,
      alamat: null,
      tempat_lahir: null,
      tanggal_lahir: null,
      jenis_kelamin: null,
      lokasi_id: user.locationId,
      lokasi_nama: user.location?.name ?? null,
      posisi_id: user.positionId,
      posisi_nama: user.position?.name ?? null,
      schedule_id: user.scheduleId,
      direct_lead_id: user.directLeadId,
      direct_lead_name: user.directLead?.namaLengkap ?? null,
      lang_pref: user.langPref,
      face_registered: user.faceRegistered,
      is_flexible_location: user.isFlexibleLocation ? 'Y' : 'N',
      allow_schedule_selection: user.allowScheduleSelection ? 'Y' : 'N',
      allow_multiple_checkout: user.allowMultipleCheckout ? 'Y' : 'N',
      allow_replacement_off: user.allowReplacementOff,
      allow_half_day: user.allowHalfDay,
      allow_joint_leave: user.allowJointLeave,
    };
  }
}
