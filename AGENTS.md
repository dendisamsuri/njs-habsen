# AGENTS.md — njs-habsen

## Context

- Project: **absensi SaaS multi-company** — backend + database saja.
- Stack wajib: **NestJS (TypeScript) + MySQL + Prisma**. Admin view = **EJS server-rendered** dari NestJS. Tidak ada PWA.
- Frontend mobile: Flutter di `C:\app\fl-habsen` — **jangan ubah dari repo ini**. Kontrak endpoint dicatat di `docs/flutter-handoff-contract.md`.
- Reference lama: `C:\app\absensi` — PHP 7.4 monolith. **READ-ONLY, jangan pernah diubah**. Dipakai untuk porting logika bisnis & test case.

## Scope

- Backend API (`/api/v1`), database (Prisma), admin EJS dashboard, face recognition proxy ke Python service.
- Fitur v1: absen (in/out, jadwal, radius, foto, koreksi+audit, process log), cuti/izin, replacement-off, approval 2-level, laporan, notifikasi, masterdata, company mgmt (platform), face recognition.

### Fitur DIBUANG (anti scope creep — jangan implementasi)

blog, chat, kunjungan, overtime, kartu nama, QR absen screen, WhatsApp, OAuth Google, PWA, billing/subscription, self-service signup, migrasi data production lama.

## Aturan kerja

1. **Tenant scope**: semua tabel tenant punya `company_id`. Query Prisma WAJIB lewat tenant extension (`src/prisma/`) — **anti-pattern: import `PrismaService` langsung di feature module**. Gunakan `TenantPrismaService`/scoped client. E2e isolation test wajib lulus.
2. **Envelope response** seragam: `{status, message, data}` / error `{status, error_code, message}`. Jangan balas body polos.
3. **i18n**: semua pesan API dari message registry (`src/i18n/`), ID default + EN. **Jangan hardcode string pesan di controller/service** — selalu pakai `error_code` + `t()`. Header `Accept-Language: id|en` (fallback `id`); pref bahasa user login meng-override. Label enum status (kehadiran, status cuti) **tidak** diterjemahkan API — UI client yang render.
4. **Prisma migration** hanya via `npm run migrate:dev` / `migrate:deploy`. Jangan edit migration yang sudah jalan; buat migration baru. Generated column `leave_balances.remaining` jangan pernah di-insert dari app.
5. **Port logika** dari PHP: baca file referensi dulu, jangan ubah file PHP. Daftar referensi di bawah.
6. **API conventions**: prefix `/api/v1`; tanpa `.php`; REST bersih; tanggal input/output ISO-8601 `YYYY-MM-DD` (bukan `dd-MM-yyyy`); `img` tetap data-URI base64; `error_code` = enum stabil SCREAMING_SNAKE.
7. **Status codes**: 400/401/403/404/405/409/422/429 — samakan semantik PHP lama.
8. `C:\app\absensi` dan `C:\app\fl-habsen` read-only dari sisi kerja repo ini.

## Referensi porting (read-only)

| Logika | File PHP |
|---|---|
| Radius/haversine/flexible | `C:\app\absensi\app\Services\AttendanceLocationService.php` |
| Check-in/out, jadwal, today-status | `C:\app\absensi\app\Models\AbsenModel.php`, `employee-api\today-status.php`, `employee-api\absen-in.php` |
| Face verify HTTP | `C:\app\absensi\app\Services\FaceRecognitionService.php`, `face-recognition-service\app.py` |
| Approval transisi + balance | `C:\app\absensi\app\Services\ApprovalTransitionService.php` |
| Supervisor scope | `C:\app\absensi\app\Services\EmployeeSupervisorAccessService.php` |
| Upload foto | `C:\app\absensi\app\Services\AttendancePhotoService.php` |
| Cron expiry replacement-off | `C:\app\absensi\cron_expire_replacement.php` |
| Laporan/filter | `C:\app\absensi\app\Controllers\AdminLaporan*` |
| JWT shape/throttle | `C:\app\absensi\employee-api\login.php`, `bootstrap.php`, `sw-library\JWT.php` |
| Schema & constraint | `C:\app\absensi\Database\baseline\schema.sql`, `Database\migrations\*` |
| Test case inspirasi jest | `C:\app\absensi\tests\*_static.php` |
| Kontrak Flutter lama | `C:\app\fl-habsen\AGENTS.md`, `lib\core\constants\api_constants.dart` |

## Perintah

```bash
npm run build          # compile
npm run lint           # eslint
npm run migrate:dev    # prisma migrate dev (butuh DB docker up)
npm run seed           # seed data
npm run test:e2e       # e2e jest (butuh DB)
docker compose up -d   # mysql + phpmyadmin (lokal dev)
```

## Deploy server (Ubuntu via SSH)

- **Server = cloud VM** (bukan mesin lokal). Akses: `ssh ubuntu` (BatchMode/key sudah terpasang di mesin dev). Jangan tanya lagi lokasi server.
- **Remote dir**: `/opt/njs-habsen`
- Mesin dev lokal **tidak ada Docker daemon / MySQL lokal** — semua perintah butuh DB (`migrate:dev`, `seed`, `test:e2e`, logs, smoke, verifikasi runtime) **wajib via `ssh ubuntu` di server**, jangan di lokal.
- **Koding di lokal, deploy ke server** — jangan edit file langsung di server kecuali `.env`.
- **Publik**: Cloudflare Tunnel → `https://sistemlvn.web.id` → `http://127.0.0.1:3000` (app bind hanya loopback; jangan buka port 3000 ke publik).

### Perintah deploy

```bat
REM Windows (pakai tar, tanpa rsync)
scripts\deploy.cmd
```

```bash
# atau bash
bash scripts/deploy.sh
```

Flow: pack tar → scp → extract ke `/opt/njs-habsen` → `docker compose -f docker-compose.prod.yml build app` → `up -d mysql` → tunggu healthy → `up -d app` → seed (idempotent) → smoke.

### Stack di server

| Item | Nilai |
|---|---|
| Compose prod | `docker-compose.prod.yml` (app + mysql:8 + face + seed profile) |
| Containers | `njs_habsen_app`, `njs_habsen_mysql`, `njs_habsen_face` |
| Port app | `127.0.0.1:3000` (di belakang tunnel) |
| Face service | `face-recognition-service/` → `http://face:8000` (internal, tanpa port publik) |
| Env | `/opt/njs-habsen/.env` — **secret di server, jangan commit** |
| Seed password demo | `Password123!` (email `*@demo.test`) |

### Cloudflare Tunnel

| Item | Nilai |
|---|---|
| Tunnel name | `njs-habsen` |
| Tunnel ID | `1c95b622-fb38-4c65-bb8b-f419ab31c498` |
| Hostname | `sistemlvn.web.id` → `http://127.0.0.1:3000` |
| Config | `/etc/cloudflared/config.yml` |
| Credentials | `/etc/cloudflared/<tunnel-id>.json` (600, root) |
| Service | `sudo systemctl {status,restart,logs} cloudflared` |
| Setup ulang | `bash scripts/cf-tunnel-setup.sh` (butuh cert login sekali) |
| DNS | CNAME ke tunnel (`cloudflared tunnel route dns -f njs-habsen sistemlvn.web.id`) |

```bash
# di server
sudo systemctl status cloudflared
sudo systemctl status docker
sudo journalctl -u cloudflared -n 50 --no-pager
cd /opt/njs-habsen && docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail 50 app
```

### Reset DB (dev/demo — hapus data)

```bash
# di server
bash /tmp/reset-db.sh   # atau scripts/reset-db.sh yang di-scp
# isinya: DROP/CREATE njs_habsen → force-recreate app (migrate deploy) → seed
```

### Smoke publik

```bash
bash scripts/tunnel-smoke.sh   # UI 200, login, today, locations, bad-login EN
```

### Catatan deploy

1. Migration di-bake ke image — ubah `prisma/migrations/**` → **wajib rebuild** image (`docker compose build app`).
2. `migration.sql` harus **UTF-8 tanpa BOM** (PowerShell `Out-File utf8` menambah BOM → Prisma P3009). Regen: `node -e "…prisma migrate diff…writeFileSync"`.
3. Jangan pakai `--sql-mode=""` di compose MySQL 8 (ditolak).
4. Setelah ganti `.env` (mis. `CORS_ORIGINS`) → `docker compose -f docker-compose.prod.yml up -d --force-recreate app`.
5. SSL/TLS di Cloudflare dashboard: **Full**.
6. Base URL Flutter: `https://sistemlvn.web.id/api/v1` (lihat `docs/flutter-handoff-contract.md`).
