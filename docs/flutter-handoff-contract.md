# Flutter Handoff Contract — njs-habsen (NestJS)

Base URL baru: `https://<host>/api/v1` (ganti `api_constants.dart`).
Envelope seragam:
- Sukses: `{ "status": "success", "message": "...", "data": ... }`
- Error: `{ "status": "error", "error_code": "SCREAMING_SNAKE", "message": "..." }`

Header: `Authorization: Bearer <access_token>`, `Accept-Language: id|en` (default `id`; pref user login override).

## Perubahan besar vs PHP lama

| Topik | Lama | Baru |
|---|---|---|
| Path | `/employee-api/*.php` | `/api/v1/...` tanpa `.php` |
| Tanggal tulis cuti / replacement | `dd-MM-yyyy` | **ISO-8601 `YYYY-MM-DD`** |
| `check-location` | field root (`in_radius`, `distance`, `is_flexible`) + nested `data` | **semua di `data.*`**: `data.in_radius`, `data.distance`, `data.is_flexible`, `data.location_name`, `data.radius_meters` |
| `face-status` | root `has_recognition` + `data` | **`data.has_recognition`**, `data.data.recognition_id`… → pakai `data.has_recognition` + `data.face` (`recognition_id`, `photo`, `photo_url`) |
| `login` | `{status, data:{token, expires_in, user}}` | sama shape, **plus** `data.refresh_token` |
| Refresh | tidak ada | `POST /auth/refresh` `{refresh_token}` → token baru (rotation) |
| Logout | bump `jwt_version` | sama + revoke refresh token |
| `status_masuk` | `Ontime\|Telat` | **`TEPAT_WAKTU\|TERLAMAT`** |
| `status_pulang` | `Pulang Cepat\|''` | **`PULANG_CEPAT\|null`** |
| `kehadiran` | `Hadir\|Cuti\|Izin` | **`HADIR\|CUTI\|IZIN\|LIBUR`** |
| `error_code` | tidak ada | selalu ada pada error — pakai untuk i18n lokal Flutter |
| `photo_url` face | URL publik lama | **`GET /api/v1/face/photo/:id` publik tanpa Bearer** |
| HEAD probe | `/employee-api` | **`HEAD /`** di root host (di luar `/api/v1`) — ditoleransi 200 |
| Izin (izin kategori) | endpoint terpisah lama | **digabung** `/leaves` (leave_type category `PERMIT`/`SICK`) |
| Notifikasi employee | tidak ada di employee-api | **baru** `GET /notifications` |

## Endpoint mapping (21 lama → baru)

| # | Lama | Baru | Method |
|---|---|---|---|
| 1 | `/employee-api/login.php` | `/auth/login` | POST |
| 2 | `/employee-api/logout.php` | `/auth/logout` | POST |
| 3 | — | `/auth/refresh` | POST |
| 4 | `/employee-api/user-profile.php` | `/me/profile` | GET |
| 5 | `/employee-api/today-status.php` | `/attendance/today` | GET |
| 6 | `/employee-api/history.php` | `/attendance/history?limit&offset` | GET |
| 7 | `/employee-api/absen-in.php` | `/attendance/in` | POST |
| 8 | `/employee-api/absen-out.php` | `/attendance/out` | POST |
| 9 | `/employee-api/check-location.php` | `/locations/check` | POST |
| 10 | `/employee-api/get-all-locations.php` | `/locations?latitude&longitude` | GET |
| 11 | `/employee-api/face-status.php` | `/face` | GET |
| 12 | `/employee-api/face-register.php` | `/face/register` | POST |
| 13 | `/employee-api/face-delete.php` | `/face/delete` | POST |
| 14 | `/employee-api/cuti-balance.php` | `/leaves/balance` | GET |
| 15 | `/employee-api/cuti-list.php` | `/leaves?limit&offset&status` | GET |
| 16 | `/employee-api/cuti-detail.php` | `/leaves/:id` | GET |
| 17 | `/employee-api/cuti-create.php` | `/leaves` | POST |
| 18 | `/employee-api/cuti-update.php` | `/leaves/:id` | PATCH |
| 19 | `/employee-api/cuti-cancel.php` | `/leaves/:id/cancel` | POST |
| 20 | `/employee-api/cuti-attachment.php` | `/leaves/:id/attachment` | GET (bytes, perlu JWT) |
| 21 | `/employee-api/replacement-off-list.php` | `/replacement-off?status` | GET |
| 22 | `/employee-api/replacement-off-submit.php` | `/replacement-off/:id/submit` | POST |
| — | (baru) | `/notifications` | GET |
| — | (baru) | `/notifications/mark-read/:id`, `/notifications/mark-all-read` | POST |
| — | (baru) | `/approvals/*` (supervisor) | GET/POST |

## Request / response per endpoint

### POST /auth/login
```json
// req
{ "email": "a@b.c", "password": "..." }
// res data
{ "token": "...", "refresh_token": "...", "expires_in": 3600, "user": {
  "id": 1, "user_id": 1, "email": "...", "nama_lengkap": "...", "nip": null,
  "role": "EMPLOYEE", "company_id": 1, "lokasi_id": 1, "posisi_id": 1,
  "schedule_id": 1, "direct_lead_id": null, "lang_pref": "id",
  "face_registered": false,
  "is_flexible_location": false, "allow_schedule_selection": false,
  "allow_multiple_checkout": false, "allow_replacement_off": true,
  "allow_half_day": true, "allow_joint_leave": true
}}
```
Catatan: flag di `user` sekarang **JSON boolean** (bukan `'Y'/'N'`). `UserModel` lama yang bertipe `String?` harus diganti `bool?`.

### GET /attendance/today → `data`
```json
{
  "date": "YYYY-MM-DD",
  "checked_in": true, "checked_out": false,
  "can_check_in": false, "can_check_out": true,
  "attendance": {
    "absen_id": 1,
    "absen_in": "08:00:12", "absen_out": "00:00:00",
    "check_in_time": "08:00:12", "check_out_time": null,
    "status_masuk": "TEPAT_WAKTU", "status_pulang": null,
    "kehadiran": "HADIR",
    "jam_kerja_in": "08:00", "jam_kerja_out": "17:00",
    "tipe": "selfie", "foto_in": "absen-....jpg", "foto_out": null,
    "latitude_in": -6.2, "longitude_in": 106.81666,
    "latitude_out": null, "longitude_out": null
  }
}
```
- Sentinel `00:00:00` **masih dipertahankan** di `absen_in`/`absen_out` (kompatibel parser lama).
- `check_in_time`/`check_out_time` = `null` bila belum absen (baru, lebih bersih).
- `can_check_in = !checked_in`, `can_check_out = checked_in && !checked_out`.

### POST /attendance/in
```json
// req
{ "latitude": -6.2, "longitude": 106.8, "schedule_id": 0, "img": "data:image/jpeg;base64,..." }
// res data
{ "already_recorded": false, "persisted": true, "absen_id": 1,
  "check_in": "08:00:12", "status_masuk": "TEPAT_WAKTU", "message_key": "SUCCESS" }
```
- `schedule_id: 0` = auto-detect (tetap).
- Idempotent: sudah absen → 200 + `already_recorded: true` (bukan error).
- `img` wajib data-URI `data:image/(jpeg|jpg|png);base64,`.
- Radius gagal → 400 `error_code: LOCATION_OUT_OF_RADIUS`.
- Wajah (mode `recognition`): 0 wajah → 400 `FACE_NO_FACE_DETECTED`; >1 wajah → 400 `FACE_MULTIPLE_FACES`; tidak cocok → 400 `FACE_VERIFY_FAILED`.

### POST /attendance/out — sama, field `check_out`, `status_pulang`.
- Belum absen masuk → 400 `ATTENDANCE_NOT_CHECKED_IN`.
- Sudah out (tanpa `allow_multiple_checkout`) → 409 `ATTENDANCE_ALREADY_CHECKED_OUT`.

### GET /attendance/history → `data`
```json
{ "limit": 30, "offset": 0, "total": 10, "records": [ {
  "absen_id": 1, "tanggal": "YYYY-MM-DD", "date": "YYYY-MM-DD",
  "tanggal_ind": "Senin, 22 September 2026",
  "absen_in": "08:00:00", "absen_out": "17:00:00",
  "check_in_time": "08:00", "check_out_time": "17:00",
  "status_masuk": "TEPAT_WAKTU", "status_pulang": null,
  "kehadiran": "HADIR", "tipe": "selfie",
  "foto_in": "...", "foto_out": "...",
  "nama_lokasi": "Kantor Pusat", "nama_lokasi_in": "...", "nama_lokasi_out": null
}]}
```

### POST /locations/check → `data` (BUKAN root lagi)
```json
{ "in_radius": true, "distance": 12.34, "is_flexible": false,
  "location_name": "Kantor Pusat", "distance_meters": 12.34, "radius_meters": 100 }
```
Parser `CheckLocationResult` pindah ke `data.*`.

### GET /locations?latitude&longitude → `data: [...]`
Sort nearest-first + `distance_meters` bila koordinat valid. Tanpa koordinat: list aktif tanpa sort.
Item: `{ lokasi_id, code, lokasi_nama, lokasi_latitude, lokasi_longitude, lokasi_radius, radius_meters, distance_meters? }`.

### GET /face → `data`
```json
{ "has_recognition": true,
  "face": { "recognition_id": 1, "photo": "face/face_1_....jpg",
            "photo_url": "/api/v1/face/photo/1" } }
```
`has_recognition` **JSON boolean asli**. `photo_url` relatif ke host — `Image.network(baseUrlOrigin + photo_url)` tanpa Bearer.

### POST /face/register `{img}` → `data` = face object (sama seperti `face` di atas).
### POST /face/delete `{recognition_id}` → 200.

### GET /leaves/balance → `data`
```json
{ "year": 2026, "total_entitlement": 12, "total_taken": 0, "total_remaining": 12,
  "allow_half_day": true,
  "types": [ { "leave_type_id": 1, "name": "...", "code": "...", "category": "LEAVE",
    "is_deductible": true, "requires_attachment": false,
    "entitlement": 12, "taken": 0, "remaining": 12, "has_balance": true } ]}
```
Semua boolean **asli JSON true/false** (wajib `== true`).

### GET /leaves → `data` `{ limit, offset, total, records: [CutiRecord] }`
CutiRecord:
```json
{ "id": 1, "leave_type_id": 1, "jenis": "Cuti Tahunan",
  "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD",
  "total_days": 2, "is_half_day": false, "reason": "...",
  "status": "pending", "status_label": "Pending",
  "has_attachment": true, "attachment_url": "/api/v1/leaves/1/attachment",
  "created_at": "ISO", "timeline": [
    { "event_type": "SUBMIT", "status": "pending", "actor_name": "...",
      "comment": null, "timestamp": "ISO", "level": 0 }]}
```
`status` lowercase: `pending|waiting_hr|approved|rejected|cancelled`.
`timeline` baru di detail (`GET /leaves/:id`).

### POST /leaves
```json
{ "leave_type_id": 1, "start_date": "2026-09-21", "end_date": "2026-09-23",
  "reason": "...", "is_half_day": false, "attachment": "data:image/jpeg;base64,..." }
```
- Tanggal **ISO** (bukan `dd-MM-yyyy`).
- Overlap → 409 `CONFLICT`; balance kurang → 400 `LEAVE_BALANCE_INSUFFICIENT`; attachment wajib → 400 `LEAVE_ATTACHMENT_REQUIRED`.

### POST /leaves/:id/cancel `{id, reason}` — reason 5–500 char.
### GET /leaves/:id/attachment — **bytes** + JWT (tetap).

### GET /replacement-off?status → `data` `{ total, records: [ReplacementOffRecord] }`
```json
{ "id": 1, "original_date": "YYYY-MM-DD", "replacement_date": null,
  "has_replacement_date": false, "is_half_day": false, "off_type": "Fullday",
  "schedule_name": "...", "time_in": "08:00:00", "time_out": "17:00:00",
  "reason": "...", "employee_note": null,
  "status": "draft", "status_label": "Draft",
  "expires_at": "YYYY-MM-DD", "is_expired": false, "can_submit": true,
  "created_at": "ISO" }
```
- `has_replacement_date`, `can_submit` → **boolean asli**.
- `is_half_day`, `is_expired` → boolean asli (toleran `1` tidak wajib lagi).
- Fitur off untuk user → 403 `REPLACEMENT_NOT_ALLOWED`.

### POST /replacement-off/:id/submit
```json
{ "id": 1, "replacement_date": "2026-09-23", "note": "optional" }
```
Tanggal **ISO**. Sukses → record ter-update (`status: "pending"`).

### GET /notifications → `data` `{ limit, offset, total, unread_count, records }`
record: `{ id, title, message, body, category, link, url, is_read, created_at, event_key, status }`.

## Boolean contract (Flutter wajib)

| Field | Bentuk wajib |
|---|---|
| `has_recognition`, `allow_half_day`, `is_deductible`, `requires_attachment`, `has_balance`, `has_attachment`, `has_replacement_date`, `can_submit`, `checked_in/out`, `can_check_in/out`, `in_radius`, `is_flexible` | **JSON `true`/`false`** |
| Flag profile (`is_flexible_location`, `allow_schedule_selection`, `allow_multiple_checkout`) | **JSON boolean** (bukan `'Y'`) — update `UserModel` |
| `allow_replacement_off`, `is_half_day`, `is_expired` | JSON boolean |

## Sentinel waktu

- `absen_in`/`absen_out` history+today: masih `"00:00:00"` bila kosong → parser `_parseApiTime` lama tetap jalan.
- Field baru `check_in_time`/`check_out_time`: `null` bila kosong (disarankan pindah ke ini).

## Status code

`400` validasi/bisnis · `401` auth · `403` scope · `404` tidak ada · `405` method · `409` konflik/duplikat · `429` throttle login · `502/503` face service.

## HEAD / (signal meter)

Flutter probe HEAD ke baseUrl root (di luar `/api/v1`) tiap 15 detik. Server jawab **200** cepat.

## i18n

`Accept-Language: id|en`. Error punya `error_code` stabil — Flutter boleh map ke `l10n` sendiri dan mengabaikan `message`.
