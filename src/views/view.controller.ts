import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  Param,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/jwt-auth.guard';
import { ReportsService } from '../reports/reports.service';
import { ApprovalTransitionService } from '../approvals/approval-transition.service';
import { resolveLocale } from '../i18n/messages';
import { err } from '../common/exceptions';

const COOKIE = 'absensi_token';
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,29}$/;
const NAV = [
  { href: '/ui/dashboard', key: 'nav_dashboard' },
  { href: '/ui/reports', key: 'nav_reports' },
  { href: '/ui/approvals', key: 'nav_approvals' },
  { href: '/ui/leaves', key: 'nav_leaves' },
  { href: '/ui/users', key: 'nav_users' },
  { href: '/ui/locations', key: 'nav_locations' },
  { href: '/ui/schedules', key: 'nav_schedules' },
  { href: '/ui/leave-types', key: 'nav_leave_types' },
  { href: '/ui/holidays', key: 'nav_holidays' },
  { href: '/ui/process-logs', key: 'nav_process_logs' },
  { href: '/ui/notifications', key: 'nav_notifications' },
  { href: '/ui/companies', key: 'nav_companies' },
];

function tr(key: string, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    nav_dashboard: { id: 'Dashboard', en: 'Dashboard' },
    nav_reports: { id: 'Laporan', en: 'Reports' },
    nav_approvals: { id: 'Persetujuan', en: 'Approvals' },
    nav_leaves: { id: 'Cuti', en: 'Leaves' },
    nav_users: { id: 'Karyawan', en: 'Employees' },
    nav_locations: { id: 'Lokasi', en: 'Locations' },
    nav_schedules: { id: 'Jadwal', en: 'Schedules' },
    nav_leave_types: { id: 'Tipe Cuti', en: 'Leave Types' },
    nav_holidays: { id: 'Libur', en: 'Holidays' },
    nav_process_logs: { id: 'Process Log', en: 'Process Log' },
    nav_notifications: { id: 'Notifikasi', en: 'Notifications' },
    nav_companies: { id: 'Perusahaan', en: 'Companies' },
    logout: { id: 'Keluar', en: 'Logout' },
    login_title: { id: 'Login Admin Absensi', en: 'Attendance Admin Login' },
    email: { id: 'Email', en: 'Email' },
    password: { id: 'Password', en: 'Password' },
    sign_in: { id: 'Masuk', en: 'Sign in' },
    today: { id: 'Hari ini', en: 'Today' },
    empty: { id: 'Tidak ada data', en: 'No data' },
    status: { id: 'Status', en: 'Status' },
    actions: { id: 'Aksi', en: 'Actions' },
    approve: { id: 'Setujui', en: 'Approve' },
    reject: { id: 'Tolak', en: 'Reject' },
    name: { id: 'Nama', en: 'Name' },
    date: { id: 'Tanggal', en: 'Date' },
    reason: { id: 'Alasan', en: 'Reason' },
    role: { id: 'Role', en: 'Role' },
    position: { id: 'Posisi', en: 'Position' },
    location: { id: 'Lokasi', en: 'Location' },
    lead: { id: 'Atasan', en: 'Supervisor' },
    company_label: { id: 'Perusahaan', en: 'Company' },
    active: { id: 'Aktif', en: 'Active' },
    code: { id: 'Kode', en: 'Code' },
    radius: { id: 'Radius (m)', en: 'Radius (m)' },
    latitude: { id: 'Latitude', en: 'Latitude' },
    longitude: { id: 'Longitude', en: 'Longitude' },
    time_in: { id: 'Jam Masuk', en: 'Time In' },
    time_out: { id: 'Jam Pulang', en: 'Time Out' },
    category: { id: 'Kategori', en: 'Category' },
    deductible: { id: 'Potong Balance', en: 'Deduct Balance' },
    attachment_req: { id: 'Wajib Lampiran', en: 'Attachment Required' },
    checkin: { id: 'Masuk', en: 'Check-in' },
    checkout: { id: 'Pulang', en: 'Check-out' },
    employee: { id: 'Karyawan', en: 'Employee' },
    flow_id: { id: 'Flow ID', en: 'Flow ID' },
    stage: { id: 'Stage', en: 'Stage' },
    started: { id: 'Mulai', en: 'Started' },
    unread: { id: 'Belum dibaca', en: 'Unread' },
    title: { id: 'Judul', en: 'Title' },
    legal_name: { id: 'Nama Legal', en: 'Legal Name' },
    add: { id: 'Tambah', en: 'Add' },
    edit: { id: 'Ubah', en: 'Edit' },
    delete: { id: 'Hapus', en: 'Delete' },
    save: { id: 'Simpan', en: 'Save' },
    cancel: { id: 'Batal', en: 'Cancel' },
    back: { id: 'Kembali', en: 'Back' },
    toggle: { id: 'Aktif/Nonaktif', en: 'Toggle' },
    confirm_delete: { id: 'Hapus data ini?', en: 'Delete this record?' },
    address: { id: 'Alamat Lengkap', en: 'Full Address' },
    location_name: { id: 'Nama Lokasi', en: 'Location Name' },
    map_pick: { id: 'Klik peta untuk isi koordinat', en: 'Click map to fill coordinates' },
    active_label: { id: 'Status Aktif', en: 'Active Status' },
    yes: { id: 'Ya', en: 'Yes' },
    no: { id: 'Tidak', en: 'No' },
    in_use: { id: 'Data lokasi ini aktif atau digunakan', en: 'This location is active or in use' },
    search_ph: { id: 'Cari di tabel…', en: 'Search in tables…' },
    overview: { id: 'Ringkasan', en: 'Overview' },
    summary: { id: 'Ringkasan', en: 'Summary' },
    quick_links: { id: 'Aksi cepat', en: 'Quick actions' },
    total_emp: { id: 'Total karyawan', en: 'Total employees' },
    present: { id: 'Hadir', en: 'Present' },
    late: { id: 'Terlambat', en: 'Late' },
    on_leave: { id: 'Izin / Cuti', en: 'Leave' },
    not_yet: { id: 'Belum absen', en: 'Not checked in' },
    attendance_today: { id: 'Kehadiran hari ini', en: "Today's attendance" },
    attendance_sub: { id: 'Pantau siapa sudah masuk, terlambat, atau belum absen.', en: 'Track who checked in, is late, or missing.' },
    view_all: { id: 'Lihat semua', en: 'View all' },
    need_approval: { id: 'Butuh persetujuan', en: 'Needs approval' },
    open_reports: { id: 'Buka laporan', en: 'Open reports' },
    manage_users: { id: 'Kelola karyawan', en: 'Manage employees' },
    manage_locations: { id: 'Kelola lokasi', en: 'Manage locations' },
    hadir_pct: { id: 'Tingkat kehadiran', en: 'Attendance rate' },
    no_data_yet: { id: 'Belum ada data untuk ditampilkan.', en: 'No data to show yet.' },
    showing: { id: 'Menampilkan', en: 'Showing' },
    rows_label: { id: 'baris', en: 'rows' },
    from: { id: 'dari', en: 'of' },
    empty_dashboard: {
      id: 'Belum ada karyawan aktif. Buka menu Karyawan untuk memeriksa data.',
      en: 'No active employees. Open the Employees menu to check your data.',
    },
    empty_reports: {
      id: 'Tidak ada absensi tercatat pada tanggal ini. Ubah tanggal di atas untuk melihat data lain.',
      en: 'No attendance recorded on this date. Change the date above to see other data.',
    },
    empty_logs: {
      id: 'Tidak ada percobaan absen pada tanggal ini. Ubah tanggal di atas untuk melihat data lain.',
      en: 'No check-in attempts on this date. Change the date above to see other data.',
    },
    empty_approvals: {
      id: 'Antrean kosong — semua pengajuan sudah diproses.',
      en: 'Queue empty — all requests have been processed.',
    },
    empty_users: { id: 'Belum ada karyawan terdaftar di perusahaan ini.', en: 'No employees registered in this company.' },
    empty_leaves: { id: 'Belum ada pengajuan cuti atau izin.', en: 'No leave or permit requests yet.' },
    empty_locations: {
      id: 'Belum ada lokasi. Tambah lokasi agar absen berbasis radius bisa dipakai.',
      en: 'No locations yet. Add a location to enable radius-based check-in.',
    },
    empty_notifications: { id: 'Belum ada notifikasi untuk Anda.', en: 'No notifications for you.' },
    empty_companies: {
      id: 'Belum ada perusahaan. Klik Tambah untuk mendaftarkan perusahaan pertama.',
      en: 'No companies yet. Add one to register your first company.',
    },
    company_name: { id: 'Nama Perusahaan', en: 'Company Name' },
    company_list: { id: 'Daftar perusahaan', en: 'Company list' },
    inactive: { id: 'Nonaktif', en: 'Inactive' },
    section_identity: { id: 'Identitas', en: 'Identity' },
    section_coordinates: { id: 'Koordinat & radius', en: 'Coordinates & radius' },
    radius_help: {
      id: 'Jarak maksimal absen dari titik lokasi, dalam meter.',
      en: 'Maximum check-in distance from the location point, in meters.',
    },
    map_title: { id: 'Peta lokasi', en: 'Location map' },
    code_auto_help: {
      id: 'Kosongkan untuk membuat kode otomatis dari nama. Maksimal 32 karakter.',
      en: 'Leave empty to derive the code from the name. Maximum 32 characters.',
    },
    name_help: { id: 'Maksimal 160 karakter.', en: 'Maximum 160 characters.' },
    code_ph: { id: 'otomatis dari nama', en: 'derived from name' },
    code_help: {
      id: 'Kosongkan untuk membuat kode otomatis dari nama. 2–30 karakter: huruf, angka, titik, strip, underscore.',
      en: 'Leave empty to derive the code from the name. 2–30 chars: letters, numbers, dot, dash, underscore.',
    },
    preview: { id: 'Pratinjau baris tabel', en: 'Table row preview' },
    preview_hint: {
      id: 'Baris tampil di menu Masterdata → Perusahaan. Nilai diambil dari form ini.',
      en: 'The row appears under Masterdata → Companies. Values come from this form.',
    },
    empty_schedules: { id: 'Belum ada jadwal kerja terdaftar.', en: 'No work schedules registered.' },
    empty_holidays: { id: 'Belum ada hari libur terdaftar.', en: 'No holidays registered.' },
    empty_leave_types: { id: 'Belum ada tipe cuti.', en: 'No leave types yet.' },
  };
  const entry = map[key];
  if (!entry) return key;
  return entry[locale] ?? entry.id;
}

@Public()
@Controller('ui')
export class ViewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly reports: ReportsService,
    private readonly approvals: ApprovalTransitionService,
  ) {}

  private locale(req: Request): string {
    const cookieLang = (req as any).cookies?.lang;
    if (cookieLang === 'en' || cookieLang === 'id') return cookieLang;
    return resolveLocale(req.headers['accept-language'] as string);
  }

  private helpers(locale: string) {
    return {
      t: (k: string) => tr(k, locale),
      nav: NAV.map((n) => ({ ...n, label: tr(n.key, locale) })),
      locale,
      langUrl: (l: string) => `/ui/lang/${l}`,
    };
  }

  private async userFrom(req: Request): Promise<any | null> {
    const token = (req as any).cookies?.[COOKIE];
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, isActive: true, deletedAt: null },
      });
      if (!user || user.jwtVersion !== payload.jwtVersion) return null;
      if (!['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'SUPERVISOR'].includes(user.role)) return null;
      return user;
    } catch {
      return null;
    }
  }

  private async requireUser(req: Request, res: Response): Promise<any | null> {
    const user = await this.userFrom(req);
    if (!user) {
      res.redirect('/ui/login');
      return null;
    }
    return user;
  }

  // PLATFORM_ADMIN has no company: list across all tenants, other roles stay scoped.
  private tenantWhere(user: any, extra: Record<string, unknown> = {}) {
    return { ...extra, ...(user.companyId == null ? {} : { companyId: user.companyId }) };
  }

  private async companyOptions() {
    return this.prisma.company.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  @Get()
  root(@Req() req: Request, @Res() res: Response) {
    if ((req as any).cookies?.[COOKIE]) return res.redirect('/ui/dashboard');
    return res.redirect('/ui/login');
  }

  @Get('login')
  loginPage(@Req() req: Request, @Res() res: Response) {
    const locale = this.locale(req);
    return res.render('login', { ...this.helpers(locale), error: null });
  }

  @Post('login')
  @HttpCode(302)
  async loginPost(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const locale = this.locale(req);
    const email = String(body?.email ?? '').toLowerCase().trim();
    const password = String(body?.password ?? '');
    const fail = (code: number, msg: string) =>
      res.status(code).render('login', { ...this.helpers(locale), error: msg });
    if (!email || !password) {
      return fail(400, locale === 'en' ? 'Email and password required' : 'Email dan password harus diisi');
    }
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return fail(401, locale === 'en' ? 'Invalid email or password' : 'Email atau password salah');
    }
    if (!['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'SUPERVISOR'].includes(user.role)) {
      return fail(403, locale === 'en' ? 'Access denied' : 'Akses ditolak');
    }
    const token = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        jwtVersion: user.jwtVersion,
        issuedFor: 'employee_api',
      },
      { secret: process.env.JWT_SECRET, expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 3600) },
    );
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Number(process.env.JWT_ACCESS_TTL ?? 3600) * 1000,
    });
    return res.redirect('/ui/dashboard');
  }

  @Post('logout')
  @HttpCode(302)
  logout(@Res() res: Response) {
    res.clearCookie(COOKIE);
    return res.redirect('/ui/login');
  }

  @Get('lang/:lang')
  lang(@Param('lang') lang: string, @Res() res: Response) {
    if (lang !== 'id' && lang !== 'en') throw err('INVALID_LANGUAGE', 400);
    res.cookie('lang', lang, { httpOnly: false, sameSite: 'lax', maxAge: 365 * 86400000 });
    return res.redirect('/ui/login');
  }

  @Get('dashboard')
  async dashboard(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const scope = {
      companyId: user.companyId,
      supervisorUserId: user.role === 'SUPERVISOR' ? user.id : null,
    };
    const today = new Date().toISOString().slice(0, 10);
    let report: any = null;
    try {
      report = await this.reports.hariIni(scope, { tanggal: today, limit: 100 });
    } catch {
      report = null;
    }
    return res.render('dashboard', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role, email: user.email },
      report,
      today,
      page: 'dashboard',
    });
  }

  @Get('users')
  async usersPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (user.role === 'SUPERVISOR') return res.redirect('/ui/dashboard');
    const locale = this.locale(req);
    const rows = await this.prisma.user.findMany({
      where: this.tenantWhere(user, { deletedAt: null }),
      include: {
        position: true,
        location: true,
        directLead: { select: { namaLengkap: true } },
        company: { select: { name: true } },
      },
      orderBy: { namaLengkap: 'asc' },
      take: 200,
    });
    return res.render('users', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      rows: rows.map((u) => ({
        id: u.id,
        nama_lengkap: u.namaLengkap,
        email: u.email,
        nip: u.nip ?? '-',
        role: u.role,
        company: u.company?.name ?? '-',
        posisi: u.position?.name ?? '-',
        lokasi: u.location?.name ?? '-',
        lead: u.directLead?.namaLengkap ?? '-',
        is_active: u.isActive,
      })),
      page: 'users',
    });
  }

  @Get('leaves')
  async leavesPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const rows = await this.prisma.leaveRequest.findMany({
      where: this.tenantWhere(user, { deletedAt: null }),
      include: {
        leaveType: true,
        user: { select: { namaLengkap: true } },
        company: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.render('leaves', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      rows: rows.map((r) => ({
        id: r.id,
        nama_lengkap: r.user.namaLengkap,
        company: r.company?.name ?? '-',
        jenis: r.leaveType.name,
        start_date: r.startDate.toISOString().slice(0, 10),
        end_date: r.endDate.toISOString().slice(0, 10),
        total_days: Number(r.totalDays),
        status: r.status,
        reason: r.reason,
      })),
      page: 'leaves',
    });
  }

  @Get('approvals')
  async approvalsPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const rows = await this.prisma.leaveRequest.findMany({
      where: this.tenantWhere(user, {
        deletedAt: null,
        status: { in: ['pending', 'waiting_hr'] as any },
        ...(user.role === 'SUPERVISOR' ? { user: { directLeadId: user.id } } : {}),
      }),
      include: {
        leaveType: true,
        user: { select: { namaLengkap: true } },
        company: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return res.render('approvals', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      rows: rows.map((r) => ({
        id: r.id,
        nama_lengkap: r.user.namaLengkap,
        company: r.company?.name ?? '-',
        jenis: r.leaveType.name,
        start_date: r.startDate.toISOString().slice(0, 10),
        end_date: r.endDate.toISOString().slice(0, 10),
        status: r.status,
        reason: r.reason,
      })),
      page: 'approvals',
    });
  }

  @Post('approvals/:id/decide')
  @HttpCode(302)
  async decide(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const id = Number((req.params as any).id);
    const decision = body?.decision === 'rejected' ? 'rejected' : 'approved';
    const comment =
      String(body?.comment ?? '') || (decision === 'rejected' ? 'Ditolak via dashboard' : '');
    await this.approvals.transition(
      'LEAVE',
      id,
      decision,
      {
        id: user.id,
        name: user.namaLengkap,
        role: user.role,
        companyId: user.companyId,
      },
      comment,
    );
    return res.redirect('/ui/approvals');
  }

  @Get('reports')
  async reportsPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const today = (req.query.tanggal as string) ?? new Date().toISOString().slice(0, 10);
    const scope = {
      companyId: user.companyId,
      supervisorUserId: user.role === 'SUPERVISOR' ? user.id : null,
    };
    let data: any = null;
    try {
      data = await this.reports.hariIni(scope, { tanggal: today, limit: 100 });
    } catch {
      data = null;
    }
    return res.render('reports', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      data,
      today,
      page: 'reports',
    });
  }

  @Get('companies')
  async companiesPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requirePlatformAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const rows = await this.prisma.company.findMany({ orderBy: { name: 'asc' } });
    return res.render('companies', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      error: (req.query.error as string) ? this.companyFormError(req.query.error as string, locale) : null,
      rows: rows.map((c) => ({ id: c.id, code: c.code, name: c.name, status: c.status })),
      page: 'companies',
    });
  }

  private requirePlatformAdmin(user: any, res: Response): boolean {
    if (user.role !== 'PLATFORM_ADMIN') {
      res.redirect('/ui/dashboard');
      return false;
    }
    return true;
  }

  private parseCompanyForm(body: any): { code: string; name: string; status: 'ACTIVE' | 'INACTIVE' } {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new Error('NAME_REQUIRED');
    if (name.length > 160) throw new Error('NAME_TOO_LONG');
    let code = String(body?.code ?? '').trim().toUpperCase();
    if (!code) {
      code = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 30);
    }
    if (!CODE_RE.test(code)) throw new Error('CODE_INVALID');
    return { code, name, status: body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' };
  }

  private companyFormError(code: string, locale: string): string {
    const id = locale !== 'en';
    switch (code) {
      case 'NAME_REQUIRED':
        return id ? 'Nama perusahaan tidak boleh kosong' : 'Company name is required';
      case 'NAME_TOO_LONG':
        return id ? 'Nama perusahaan maksimal 160 karakter' : 'Company name is limited to 160 characters';
      case 'CODE_INVALID':
        return id
          ? 'Kode perusahaan wajib 2-30 karakter: huruf, angka, titik, strip, underscore'
          : 'Company code must be 2-30 chars: letters, numbers, dot, dash, underscore';
      case 'NAME_EXISTS':
        return id ? 'Nama atau kode perusahaan sudah dipakai' : 'Company name or code already exists';
      case 'IN_USE':
        return id
          ? 'Perusahaan masih memiliki data (karyawan, lokasi, atau absensi)'
          : 'Company still has data (employees, locations, or attendance)';
      default:
        return id ? 'Gagal menyimpan perusahaan' : 'Failed to save company';
    }
  }

  private companyFormKeep(src: any) {
    return {
      id: src?.id,
      code: src?.code ?? '',
      name: src?.name ?? '',
      status: src?.status ?? 'ACTIVE',
    };
  }

  @Get('companies/new')
  async companyNewPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requirePlatformAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    return res.render('company-form', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      error: null,
      row: null,
      page: 'companies',
    });
  }

  @Get('companies/:id/edit')
  async companyEditPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requirePlatformAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const id = Number((req.params as any).id);
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) return res.redirect('/ui/companies');
    return res.render('company-form', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      error: null,
      row: { id: row.id, code: row.code, name: row.name, status: row.status },
      page: 'companies',
    });
  }

  @Post('companies')
  @HttpCode(302)
  async companyCreate(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requirePlatformAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const fail = (code: string, keep: any) =>
      res.status(400).render('company-form', {
        ...this.helpers(locale),
        user: { nama_lengkap: user.namaLengkap, role: user.role },
        error: this.companyFormError(code, locale),
        row: keep,
        page: 'companies',
      });
    let v: ReturnType<ViewController['parseCompanyForm']>;
    try {
      v = this.parseCompanyForm(body);
    } catch (e: any) {
      return fail(e?.message ?? 'SAVE_FAILED', this.companyFormKeep(body));
    }
    const dup = await this.prisma.company.findFirst({ where: { OR: [{ code: v.code }, { name: v.name }] } });
    if (dup) return fail('NAME_EXISTS', this.companyFormKeep(v));
    const company = await this.prisma.company.create({ data: v });
    await this.prisma.companySetting.create({ data: { companyId: company.id } });
    return res.redirect('/ui/companies');
  }

  @Post('companies/:id')
  @HttpCode(302)
  async companyUpdate(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requirePlatformAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const id = Number((req.params as any).id);
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) return res.redirect('/ui/companies');
    const fail = (code: string, keep: any) =>
      res.status(400).render('company-form', {
        ...this.helpers(locale),
        user: { nama_lengkap: user.namaLengkap, role: user.role },
        error: this.companyFormError(code, locale),
        row: keep,
        page: 'companies',
      });
    let v: ReturnType<ViewController['parseCompanyForm']>;
    try {
      v = this.parseCompanyForm(body);
    } catch (e: any) {
      return fail(e?.message ?? 'SAVE_FAILED', this.companyFormKeep({ ...body, id }));
    }
    const dup = await this.prisma.company.findFirst({
      where: { id: { not: id }, OR: [{ code: v.code }, { name: v.name }] },
    });
    if (dup) return fail('NAME_EXISTS', this.companyFormKeep({ ...v, id }));
    return this.prisma.company.update({ where: { id }, data: v }).then(() => res.redirect('/ui/companies'));
  }

  @Post('companies/:id/toggle')
  @HttpCode(302)
  async companyToggle(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requirePlatformAdmin(user, res)) return res as any;
    const id = Number((req.params as any).id);
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (row) {
      await this.prisma.company.update({
        where: { id },
        data: { status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
      });
    }
    return res.redirect('/ui/companies');
  }

  @Post('companies/:id/delete')
  @HttpCode(302)
  async companyDelete(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requirePlatformAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const id = Number((req.params as any).id);
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) return res.redirect('/ui/companies');
    const [users, locations, attendances, leaveRequests] = await Promise.all([
      this.prisma.user.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.location.count({ where: { companyId: id } }),
      this.prisma.attendances.count({ where: { companyId: id } }),
      this.prisma.leaveRequest.count({ where: { companyId: id } }),
    ]);
    if (users + locations + attendances + leaveRequests > 0) {
      return res.status(409).render('companies', {
        ...this.helpers(locale),
        user: { nama_lengkap: user.namaLengkap, role: user.role },
        error: this.companyFormError('IN_USE', locale),
        rows: (await this.prisma.company.findMany({ orderBy: { name: 'asc' } })).map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          status: c.status,
        })),
        page: 'companies',
      });
    }
    await this.prisma.companySetting.deleteMany({ where: { companyId: id } });
    await this.prisma.company.delete({ where: { id } });
    return res.redirect('/ui/companies');
  }

  @Get('locations')
  async locationsPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const rows = await this.prisma.location.findMany({
      where: this.tenantWhere(user),
      include: { company: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return res.render('locations', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      error: null,
      canEdit: user.role !== 'SUPERVISOR',
      rows: rows.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        company: l.company?.name ?? '-',
        address: (l as any).address ?? '',
        latitude: String(l.latitude),
        longitude: String(l.longitude),
        radiusMeters: l.radiusMeters,
        status: l.status,
      })),
      page: 'locations',
    });
  }

  // Port of legacy lokasi.php op=add/update — form + save via UI.
  // Only PLATFORM_ADMIN / COMPANY_ADMIN may mutate (legacy: modifikasi/hapus).
  private requireLocationAdmin(user: any, res: Response): boolean {
    if (user.role === 'SUPERVISOR') {
      res.redirect('/ui/locations');
      return false;
    }
    return true;
  }

  private parseLocationForm(body: any): {
    code: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    status: 'Y' | 'N';
  } {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new Error('NAME_REQUIRED');
    const address = String(body?.address ?? '').trim();
    if (!address) throw new Error('ADDRESS_REQUIRED');
    if (address.length > 500) throw new Error('ADDRESS_TOO_LONG');
    const latitude = Number(body?.latitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('LAT_INVALID');
    const longitude = Number(body?.longitude);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('LON_INVALID');
    const radiusMeters = Number(body?.radius_meters ?? 900);
    if (!Number.isInteger(radiusMeters) || radiusMeters < 1) throw new Error('RADIUS_INVALID');
    let code = String(body?.code ?? '').trim();
    if (!code) {
      code = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 32);
    }
    if (!code) throw new Error('CODE_REQUIRED');
    return { code, name, address, latitude, longitude, radiusMeters, status: body?.status === 'Y' ? 'Y' : 'N' };
  }

  private locationFormError(code: string, locale: string): string {
    const id = locale !== 'en';
    switch (code) {
      case 'NAME_REQUIRED':
        return id ? 'Nama lokasi tidak boleh kosong' : 'Location name is required';
      case 'ADDRESS_REQUIRED':
        return id ? 'Alamat lengkap tidak boleh kosong' : 'Full address is required';
      case 'ADDRESS_TOO_LONG':
        return id ? 'Alamat maksimal 500 karakter' : 'Address must be at most 500 characters';
      case 'LAT_INVALID':
        return id ? 'Latitude tidak valid' : 'Invalid latitude';
      case 'LON_INVALID':
        return id ? 'Longitude tidak valid' : 'Invalid longitude';
      case 'RADIUS_INVALID':
        return id ? 'Radius harus lebih dari 0' : 'Radius must be greater than 0';
      case 'CODE_REQUIRED':
        return id ? 'Kode tidak valid' : 'Invalid code';
      case 'NAME_EXISTS':
        return id ? 'Lokasi dengan nama tersebut sudah ada' : 'Location with this name already exists';
      case 'COMPANY_REQUIRED':
        return id ? 'Pilih perusahaan terlebih dahulu' : 'Select a company first';
      case 'IN_USE':
        return id ? 'Data lokasi ini aktif atau digunakan' : 'This location is active or in use';
      default:
        return id ? 'Lokasi tidak berhasil disimpan' : 'Failed to save location';
    }
  }

  @Get('locations/new')
  async locationNewPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requireLocationAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    return res.render('location-form', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      error: null,
      row: null,
      companies: user.companyId == null ? await this.companyOptions() : null,
      companyId: user.companyId,
      page: 'locations',
    });
  }

  @Get('locations/:id/edit')
  async locationEditPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requireLocationAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const id = Number((req.params as any).id);
    const row = await this.prisma.location.findFirst({ where: this.tenantWhere(user, { id }) });
    if (!row) return res.redirect('/ui/locations');
    return res.render('location-form', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      error: null,
      companies: user.companyId == null ? await this.companyOptions() : null,
      companyId: row.companyId,
      row: {
        id: row.id,
        code: row.code,
        name: row.name,
        address: (row as any).address ?? '',
        latitude: String(row.latitude),
        longitude: String(row.longitude),
        radiusMeters: row.radiusMeters,
        status: row.status,
      },
      page: 'locations',
    });
  }

  @Post('locations')
  @HttpCode(302)
  async locationCreate(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requireLocationAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const keepOf = (src: any) => ({
      id: undefined,
      code: src?.code ?? src?.Code ?? '',
      name: src?.name ?? '',
      address: src?.address ?? '',
      latitude: src?.latitude ?? '',
      longitude: src?.longitude ?? '',
      radiusMeters: src?.radiusMeters ?? src?.radius_meters ?? 900,
      status: src?.status ?? 'Y',
    });
    const fail = async (code: string, keep: any) =>
      res.status(400).render('location-form', {
        ...this.helpers(locale),
        user: { nama_lengkap: user.namaLengkap, role: user.role },
        error: this.locationFormError(code, locale),
        row: keep,
        companies: user.companyId == null ? await this.companyOptions() : null,
        companyId: user.companyId ?? (Number(body?.companyId) || null),
        page: 'locations',
      });
    let v: ReturnType<ViewController['parseLocationForm']>;
    try {
      v = this.parseLocationForm(body);
    } catch (e: any) {
      return fail(e?.message ?? 'SAVE_FAILED', keepOf(body));
    }
    // platform admin picks the target company; others inherit their own
    let companyId = user.companyId;
    if (companyId == null) {
      const picked = Number(body?.companyId);
      const exists =
        Number.isInteger(picked) &&
        picked > 0 &&
        (await this.prisma.company.findUnique({ where: { id: picked } }));
      if (!exists) return fail('COMPANY_REQUIRED', keepOf(body));
      companyId = picked;
    }
    const dup = await this.prisma.location.findFirst({
      where: { companyId, OR: [{ name: v.name }, { code: v.code }] },
    });
    if (dup) return fail('NAME_EXISTS', keepOf(v));
    await this.prisma.location.create({
      data: {
        companyId,
        code: v.code,
        name: v.name,
        address: v.address,
        latitude: v.latitude,
        longitude: v.longitude,
        radiusMeters: v.radiusMeters,
        status: v.status,
      },
    });
    return res.redirect('/ui/locations');
  }

  @Post('locations/:id')
  @HttpCode(302)
  async locationUpdate(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requireLocationAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const id = Number((req.params as any).id);
    const existing = await this.prisma.location.findFirst({ where: this.tenantWhere(user, { id }) });
    if (!existing) return res.redirect('/ui/locations');
    const keepOf = (src: any) => ({
      id,
      code: src?.code ?? '',
      name: src?.name ?? '',
      address: src?.address ?? '',
      latitude: src?.latitude ?? '',
      longitude: src?.longitude ?? '',
      radiusMeters: src?.radiusMeters ?? src?.radius_meters ?? 900,
      status: src?.status ?? 'Y',
    });
    const fail = async (code: string) =>
      res.status(400).render('location-form', {
        ...this.helpers(locale),
        user: { nama_lengkap: user.namaLengkap, role: user.role },
        error: this.locationFormError(code, locale),
        row: keepOf(body),
        companies: user.companyId == null ? await this.companyOptions() : null,
        companyId: user.companyId ?? existing.companyId,
        page: 'locations',
      });
    let v: ReturnType<ViewController['parseLocationForm']>;
    try {
      v = this.parseLocationForm(body);
    } catch (e: any) {
      return fail(e?.message ?? 'SAVE_FAILED');
    }
    // platform admin may move a location to another company
    let companyId = existing.companyId;
    if (user.companyId == null && body?.companyId != null && body.companyId !== '') {
      const picked = Number(body.companyId);
      const exists =
        Number.isInteger(picked) &&
        picked > 0 &&
        (await this.prisma.company.findUnique({ where: { id: picked } }));
      if (!exists) return fail('COMPANY_REQUIRED');
      companyId = picked;
    }
    const dup = await this.prisma.location.findFirst({
      where: { companyId, NOT: { id }, OR: [{ name: v.name }, { code: v.code }] },
    });
    if (dup) return fail('NAME_EXISTS');
    await this.prisma.location.update({
      where: { id },
      data: {
        companyId,
        code: v.code,
        name: v.name,
        address: v.address,
        latitude: v.latitude,
        longitude: v.longitude,
        radiusMeters: v.radiusMeters,
        status: v.status,
      },
    });
    return res.redirect('/ui/locations');
  }

  @Post('locations/:id/toggle')
  @HttpCode(302)
  async locationToggle(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requireLocationAdmin(user, res)) return res as any;
    const id = Number((req.params as any).id);
    const row = await this.prisma.location.findFirst({ where: this.tenantWhere(user, { id }) });
    if (row) {
      await this.prisma.location.update({ where: { id }, data: { status: row.status === 'Y' ? 'N' : 'Y' } });
    }
    return res.redirect('/ui/locations');
  }

  @Post('locations/:id/delete')
  @HttpCode(302)
  async locationDelete(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    if (!this.requireLocationAdmin(user, res)) return res as any;
    const locale = this.locale(req);
    const id = Number((req.params as any).id);
    const row = await this.prisma.location.findFirst({ where: this.tenantWhere(user, { id }) });
    if (row) {
      const used = await this.prisma.user.count({ where: { locationId: id } });
      if (used > 0) {
        const rows = await this.prisma.location.findMany({
          where: this.tenantWhere(user),
          include: { company: { select: { name: true } } },
          orderBy: { name: 'asc' },
        });
        return res.status(409).render('locations', {
          ...this.helpers(locale),
          user: { nama_lengkap: user.namaLengkap, role: user.role },
          error: this.locationFormError('IN_USE', locale),
          canEdit: user.role !== 'SUPERVISOR',
          rows: rows.map((l) => ({
            id: l.id,
            code: l.code,
            name: l.name,
            company: l.company?.name ?? '-',
            address: (l as any).address ?? '',
            latitude: String(l.latitude),
            longitude: String(l.longitude),
            radiusMeters: l.radiusMeters,
            status: l.status,
          })),
          page: 'locations',
        });
      }
      await this.prisma.location.delete({ where: { id } });
    }
    return res.redirect('/ui/locations');
  }

  @Get('schedules')
  async schedulesPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const rows = await this.prisma.schedule.findMany({
      where: this.tenantWhere(user),
      include: { details: true, company: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return res.render('schedules', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      rows: rows.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        company: s.company?.name ?? '-',
        is_active: s.isActive,
        detail_count: s.details.length,
        details: s.details.map((d) => ({
          day: d.dayOfWeek,
          time_in: d.timeIn,
          time_out: d.timeOut,
          tolerance: d.toleranceMinutes,
        })),
      })),
      page: 'schedules',
    });
  }

  @Get('leave-types')
  async leaveTypesPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const rows = await this.prisma.leaveType.findMany({
      where: this.tenantWhere(user),
      include: { company: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return res.render('leave-types', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      rows: rows.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        company: l.company?.name ?? '-',
        category: l.category,
        is_deductible: l.isDeductible,
        requires_attachment: l.requiresAttachment,
        is_active: l.isActive,
      })),
      page: 'leave-types',
    });
  }

  @Get('holidays')
  async holidaysPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const rows = await this.prisma.holiday.findMany({
      where: this.tenantWhere(user),
      include: { company: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });
    return res.render('holidays', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      rows: rows.map((h) => ({
        id: h.id,
        tanggal: h.date.toISOString().slice(0, 10),
        name: h.name,
        company: h.company?.name ?? '-',
      })),
      page: 'holidays',
    });
  }

  @Get('notifications')
  async notificationsPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const rows = await this.prisma.notification.findMany({
      where: this.tenantWhere(user, {
        OR: [
          { recipientType: 'USER', recipientId: user.id },
          { recipientType: 'ROLE', role: user.role },
        ],
      }),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.render('notifications', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      rows: rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body ?? '',
        is_read: n.isRead,
        created_at: n.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      })),
      page: 'notifications',
    });
  }

  @Get('process-logs')
  async processLogsPage(@Req() req: Request, @Res() res: Response) {
    const user = await this.requireUser(req, res);
    if (!user) return res as any;
    const locale = this.locale(req);
    const today = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
    let data: any = null;
    try {
      data = await this.reports.processLog(
        {
          companyId: user.companyId,
          supervisorUserId: user.role === 'SUPERVISOR' ? user.id : null,
        },
        { date: today, limit: 50 },
      );
    } catch {
      data = null;
    }
    return res.render('process-logs', {
      ...this.helpers(locale),
      user: { nama_lengkap: user.namaLengkap, role: user.role },
      data,
      today,
      page: 'process-logs',
    });
  }
}
