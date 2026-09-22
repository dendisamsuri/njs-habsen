import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Password123!', 10);

  const platform = await prisma.user.upsert({
    where: { email: 'platform@demo.test' },
    update: {},
    create: {
      email: 'platform@demo.test',
      passwordHash: password,
      namaLengkap: 'Platform Admin',
      role: 'PLATFORM_ADMIN',
      companyId: null,
      langPref: 'id',
    },
  });

  const company = await prisma.company.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: {
      code: 'DEMO',
      name: 'PT Demo Absensi',
      status: 'ACTIVE',
      settings: { timezone: 'Asia/Jakarta' },
    },
  });

  await prisma.companySetting.upsert({
    where: { companyId: company.id },
    update: {},
    create: { companyId: company.id, timezone: 'Asia/Jakarta', tipeAbsen: 'selfie' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.test' },
    update: {},
    create: {
      email: 'admin@demo.test',
      passwordHash: password,
      namaLengkap: 'Company Admin',
      role: 'COMPANY_ADMIN',
      companyId: company.id,
      langPref: 'id',
    },
  });

  const position = await prisma.position.upsert({
    where: { companyId_code: { companyId: company.id, code: 'STAFF' } },
    update: {},
    create: { companyId: company.id, code: 'STAFF', name: 'Staff' },
  });

  const location = await prisma.location.upsert({
    where: { companyId_code: { companyId: company.id, code: 'HQ' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'HQ',
      name: 'Kantor Pusat',
      latitude: -6.2,
      longitude: 106.8166667,
      radiusMeters: 100,
      status: 'Y',
    },
  });

  const schedule = await prisma.schedule.upsert({
    where: { companyId_code: { companyId: company.id, code: 'WD' } },
    update: {},
    create: { companyId: company.id, code: 'WD', name: 'Kerja Reguler' },
  });

  const weekdays = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ] as const;
  for (const day of weekdays) {
    await prisma.scheduleDetail.upsert({
      where: { scheduleId_dayOfWeek: { scheduleId: schedule.id, dayOfWeek: day } },
      update: {},
      create: {
        scheduleId: schedule.id,
        dayOfWeek: day,
        timeIn: '08:00:00',
        timeOut: '17:00:00',
        toleranceMinutes: 15,
      },
    });
  }

  const leaveTypes = [
    { code: 'CUTI_TAHUNAN', name: 'Cuti Tahunan', category: 'LEAVE' as const, isDeductible: true, requiresAttachment: false },
    { code: 'SAKIT', name: 'Izin Sakit', category: 'SICK' as const, isDeductible: false, requiresAttachment: true },
    { code: 'IZIN', name: 'Izin', category: 'PERMIT' as const, isDeductible: false, requiresAttachment: false },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { companyId_code: { companyId: company.id, code: lt.code } },
      update: {},
      create: { companyId: company.id, ...lt },
    });
  }

  const sup = await prisma.user.upsert({
    where: { email: 'supervisor@demo.test' },
    update: {},
    create: {
      email: 'supervisor@demo.test',
      passwordHash: password,
      namaLengkap: 'Supervisor Satu',
      role: 'SUPERVISOR',
      companyId: company.id,
      positionId: position.id,
      locationId: location.id,
      scheduleId: schedule.id,
      langPref: 'id',
    },
  });

  const emp = await prisma.user.upsert({
    where: { email: 'employee@demo.test' },
    update: {},
    create: {
      email: 'employee@demo.test',
      passwordHash: password,
      namaLengkap: 'Karyawan Satu',
      role: 'EMPLOYEE',
      companyId: company.id,
      positionId: position.id,
      locationId: location.id,
      scheduleId: schedule.id,
      directLeadId: sup.id,
      langPref: 'id',
    },
  });

  const year = new Date().getFullYear();
  const cutiTahunan = await prisma.leaveType.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: 'CUTI_TAHUNAN' } },
  });
  await prisma.leaveBalance.upsert({
    where: {
      companyId_userId_leaveTypeId_year: {
        companyId: company.id,
        userId: emp.id,
        leaveTypeId: cutiTahunan.id,
        year,
      },
    },
    update: {},
    create: {
      companyId: company.id,
      userId: emp.id,
      leaveTypeId: cutiTahunan.id,
      year,
      entitlement: 12,
      taken: 0,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed done', {
    platform: platform.email,
    admin: admin.email,
    sup: sup.email,
    emp: emp.email,
    company: company.code,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
