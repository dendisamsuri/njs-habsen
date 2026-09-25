// Message registry — ID (default) + EN. Keys = error_code SCREAMING_SNAKE.
export type Locale = 'id' | 'en';

export const MESSAGES: Record<string, Record<Locale, string>> = {
  // generic
  SUCCESS: { id: 'Berhasil', en: 'Success' },
  VALIDATION_ERROR: { id: 'Permintaan tidak valid', en: 'Invalid request' },
  UNAUTHORIZED: { id: 'Tidak terautentikasi', en: 'Unauthorized' },
  TOKEN_EXPIRED: { id: 'Sesi berakhir, silakan login ulang', en: 'Session expired, please login again' },
  TOKEN_INVALID: { id: 'Token tidak valid', en: 'Invalid token' },
  FORBIDDEN: { id: 'Anda tidak memiliki akses', en: 'You do not have access' },
  NOT_FOUND: { id: 'Data tidak ditemukan', en: 'Data not found' },
  METHOD_NOT_ALLOWED: { id: 'Metode tidak diizinkan', en: 'Method not allowed' },
  CONFLICT: { id: 'Data konflik', en: 'Data conflict' },
  DUPLICATE: { id: 'Data sudah ada', en: 'Data already exists' },
  SERVER_ERROR: { id: 'Terjadi kesalahan server', en: 'Server error occurred' },
  RATE_LIMITED: { id: 'Terlalu banyak permintaan, coba lagi nanti', en: 'Too many requests, try again later' },
  INVALID_CREDENTIALS: { id: 'Email atau password salah', en: 'Invalid email or password' },
  ACCOUNT_BLOCKED: { id: 'Akun terkunci karena terlalu banyak percobaan gagal', en: 'Account locked after too many failed attempts' },
  ACCOUNT_INACTIVE: { id: 'Akun tidak aktif', en: 'Account inactive' },
  LOGIN_THROTTLE: { id: 'Percobaan login terlalu banyak, coba lagi nanti', en: 'Too many login attempts, try again later' },
  INVALID_LANGUAGE: { id: 'Bahasa tidak didukung', en: 'Unsupported language' },
  REFRESH_INVALID: { id: 'Sesi tidak valid, silakan login ulang', en: 'Invalid session, please login again' },

  // attendance
  ATTENDANCE_ALREADY_CHECKED_IN: { id: 'Anda sudah absen masuk hari ini', en: 'You already checked in today' },
  ATTENDANCE_ALREADY_CHECKED_OUT: { id: 'Anda sudah absen out hari ini', en: 'You already checked out today' },
  ATTENDANCE_NOT_CHECKED_IN: { id: 'Silahkan absen masuk terlebih dahulu', en: 'Please check in first' },
  ATTENDANCE_ALREADY_RECORDED: { id: 'Absensi Anda sudah tercatat hari ini', en: 'Your attendance is already recorded today' },
  ATTENDANCE_DUPLICATE: { id: 'Absensi untuk tanggal ini sudah ada', en: 'Attendance for this date already exists' },
  NO_SCHEDULE_TODAY: { id: 'Anda tidak memiliki jadwal kerja pada hari ini', en: 'You have no work schedule today' },
  LOCATION_OUT_OF_RADIUS: { id: 'Posisi Anda saat ini jauh dari lokasi yang diizinkan!', en: 'Your current position is far from the allowed location!' },
  COORDINATES_INVALID: { id: 'Koordinat tidak valid', en: 'Invalid coordinates' },
  COORDINATES_REQUIRED: { id: 'Koordinat wajib diisi', en: 'Coordinates are required' },
  PHOTO_REQUIRED: { id: 'Foto harus diisi', en: 'Photo is required' },
  PHOTO_UPLOAD_FAILED: { id: 'Gagal mengupload foto!', en: 'Failed to upload photo!' },
  PHOTO_INVALID_TYPE: { id: 'Tipe foto tidak diizinkan', en: 'Photo type not allowed' },
  PHOTO_TOO_LARGE: { id: 'Ukuran foto terlalu besar', en: 'Photo too large' },
  BLOCKED_BY_LEAVE: { id: 'Tanggal ini sedang dalam masa cuti', en: 'This date is during approved leave' },
  BLOCKED_BY_PERMIT: { id: 'Tanggal ini sedang dalam masa izin', en: 'This date is during approved permit' },
  BLOCKED_BY_REPLACEMENT_OFF: { id: 'Tanggal ini sedang dalam masa replacement off', en: 'This date is during replacement off' },
  LOCATION_NOT_FOUND: { id: 'Lokasi tidak ditemukan', en: 'Location not found' },
  LOCATION_NAME_REQUIRED: { id: 'Nama lokasi tidak boleh kosong', en: 'Location name is required' },
  LOCATION_ADDRESS_REQUIRED: { id: 'Alamat lengkap tidak boleh kosong', en: 'Full address is required' },
  LOCATION_RADIUS_INVALID: { id: 'Radius harus lebih dari 0', en: 'Radius must be greater than 0' },
  LOCATION_NAME_EXISTS: { id: 'Lokasi dengan nama tersebut sudah ada', en: 'Location with this name already exists' },
  LOCATION_IN_USE: { id: 'Data lokasi ini aktif atau digunakan', en: 'This location is active or in use' },
  LOCATION_SAVE_FAILED: { id: 'Lokasi tidak berhasil disimpan', en: 'Failed to save location' },
  LOCATION_UPDATE_FAILED: { id: 'Lokasi tidak berhasil diperbarui', en: 'Failed to update location' },

  // face
  FACE_NOT_REGISTERED: { id: 'Foto master belum tersedia. Silakan daftarkan wajah Anda.', en: 'Master photo missing. Please register your face.' },
  FACE_ALREADY_REGISTERED: { id: 'Wajah sudah terdaftar', en: 'Face already registered' },
  FACE_VERIFY_FAILED: { id: 'Wajah tidak cocok dengan foto master. Silakan coba kembali.', en: 'Face does not match master photo. Please try again.' },
  FACE_NO_FACE_DETECTED: { id: 'Wajah tidak terdeteksi. Pastikan wajah jelas di kamera dan pencahayaan cukup.', en: 'No face detected. Make sure your face is clear and lighting is enough.' },
  FACE_MULTIPLE_FACES: { id: 'Wajah tidak boleh lebih dari 1. Pastikan hanya satu wajah di frame.', en: 'Only one face is allowed. Make sure just one face is in the frame.' },
  FACE_SERVICE_UNAVAILABLE: { id: 'Layanan pengenalan wajah tidak tersedia', en: 'Face recognition service unavailable' },
  FACE_SERVICE_ERROR: { id: 'Terjadi kesalahan pada layanan wajah', en: 'Face service error' },

  // leaves
  LEAVE_NOT_FOUND: { id: 'Pengajuan cuti tidak ditemukan', en: 'Leave request not found' },
  LEAVE_ALREADY_PROCESSED: { id: 'Pengajuan sudah diproses atau statusnya berubah', en: 'Request already processed or status changed' },
  LEAVE_SELF_APPROVAL_DENIED: { id: 'Tidak dapat menyetujui pengajuan sendiri', en: 'Cannot approve your own request' },
  LEAVE_NOT_DIRECT_REPORT: { id: 'Anda bukan atasan langsung karyawan ini', en: 'You are not this employee\u2019s direct supervisor' },
  LEAVE_INVALID_DATES: { id: 'Tanggal tidak valid', en: 'Invalid dates' },
  LEAVE_ATTACHMENT_REQUIRED: { id: 'Lampiran wajib diunggah', en: 'Attachment is required' },
  LEAVE_ATTACHMENT_INVALID: { id: 'Lampiran tidak valid', en: 'Invalid attachment' },
  LEAVE_BALANCE_INSUFFICIENT: { id: 'Sisa cuti tidak mencukupi', en: 'Insufficient leave balance' },
  LEAVE_COMMENT_INVALID: { id: 'Komentar tidak valid (5-500 karakter untuk penolakan)', en: 'Invalid comment (5-500 chars required for rejection)' },
  LEAVE_INVALID_TRANSITION: { id: 'Status pengajuan sudah berubah, muat ulang halaman', en: 'Request status already changed, reload the page' },
  LEAVE_INVALID_ACTOR: { id: 'Anda tidak berwenang memutuskan pengajuan ini', en: 'You are not authorized to decide this request' },
  LEAVE_SUCCESS_MESSAGE: { id: 'Status pengajuan berhasil diperbarui', en: 'Request status updated' },
  LEAVE_FORWARDED_HR: { id: 'Pengajuan diteruskan untuk persetujuan HR', en: 'Request forwarded for HR approval' },
  LEAVE_APPROVED_OK: { id: 'Pengajuan disetujui', en: 'Request approved' },
  LEAVE_REJECTED_OK: { id: 'Pengajuan ditolak', en: 'Request rejected' },
  LEAVE_CANCELLED: { id: 'Pengajuan dibatalkan', en: 'Request cancelled' },
  LEAVE_NOT_CANCELABLE: { id: 'Pengajuan tidak dapat dibatalkan', en: 'Request cannot be cancelled' },
  LEAVE_SAVE_FAILED: { id: 'Gagal menyimpan pengajuan', en: 'Failed to save request' },

  // replacement off
  REPLACEMENT_NOT_FOUND: { id: 'Replacement off tidak ditemukan', en: 'Replacement off not found' },
  REPLACEMENT_EXPIRED: { id: 'Replacement off sudah kedaluwarsa', en: 'Replacement off expired' },
  REPLACEMENT_NOT_SUBMITTABLE: { id: 'Replacement off tidak dapat diajukan', en: 'Replacement off cannot be submitted' },
  REPLACEMENT_NOT_ALLOWED: { id: 'Anda tidak diizinkan mengajukan replacement off', en: 'You are not allowed to request replacement off' },
  REPLACEMENT_INVALID_DATE: { id: 'Tanggal replacement tidak valid', en: 'Invalid replacement date' },
  REPLACEMENT_EXPIRY_FAILED: { id: 'Gagal memproses kedaluwarsa replacement off', en: 'Failed to process replacement off expiry' },

  // approvals
  APPROVAL_INVALID_LEVEL: { id: 'Level persetujuan tidak valid', en: 'Invalid approval level' },
  APPROVAL_ALREADY_DECIDED: { id: 'Keputusan sudah diberikan', en: 'Decision already made' },
  APPROVAL_SIDE_EFFECT_FAILED: { id: 'Gagal memproses pengajuan', en: 'Failed to process request' },

  // admin / masterdata
  COMPANY_REQUIRED: { id: 'Pilih perusahaan terlebih dahulu', en: 'Select a company first' },
  IN_USE: { id: 'Data masih dipakai, tidak bisa diubah atau dihapus', en: 'Record is still in use, cannot change or delete' },
  EMP_NAME_REQUIRED: { id: 'Nama lengkap wajib diisi', en: 'Full name is required' },
  EMP_EMAIL_REQUIRED: { id: 'Email wajib diisi', en: 'Email is required' },
  EMP_EMAIL_INVALID: { id: 'Format email tidak valid', en: 'Invalid email format' },
  EMP_PASSWORD_SHORT: { id: 'Password minimal 8 karakter', en: 'Password must be at least 8 characters' },
  EMP_POSITION_INVALID: { id: 'Posisi tidak valid atau di luar perusahaan ini', en: 'Position is invalid or outside this company' },
  EMP_LOCATION_INVALID: { id: 'Lokasi tidak valid atau di luar perusahaan ini', en: 'Location is invalid or outside this company' },
  EMP_SCHEDULE_INVALID: { id: 'Jadwal tidak valid atau di luar perusahaan ini', en: 'Schedule is invalid or outside this company' },
  EMP_LEAD_INVALID: { id: 'Atasan langsung tidak valid atau di luar perusahaan ini', en: 'Direct supervisor is invalid or outside this company' },
  EMP_DOB_INVALID: { id: 'Tanggal lahir tidak valid (format YYYY-MM-DD)', en: 'Invalid date of birth (use YYYY-MM-DD)' },
  ENT_USER_REQUIRED: { id: 'Pilih karyawan terlebih dahulu', en: 'Select an employee first' },
  ENT_TYPE_REQUIRED: { id: 'Pilih tipe cuti terlebih dahulu', en: 'Select a leave type first' },
  ENT_YEAR_INVALID: { id: 'Tahun tidak valid', en: 'Invalid year' },
  ENT_VALUE_INVALID: { id: 'Jumlah jatah cuti tidak valid', en: 'Invalid leave entitlement amount' },
  ENT_USER_INVALID: { id: 'Karyawan tidak ditemukan di perusahaan ini', en: 'Employee not found in this company' },
  ENT_TYPE_INVALID: { id: 'Tipe cuti tidak ditemukan di perusahaan ini', en: 'Leave type not found in this company' },
  ENT_COMPANY_MISMATCH: { id: 'Karyawan dan tipe cuti harus dalam satu perusahaan', en: 'Employee and leave type must be in the same company' },
  ENT_BELOW_TAKEN: { id: 'Jatah tidak boleh lebih kecil dari cuti yang sudah terpakai', en: 'Entitlement cannot be less than leave already taken' },
  ENT_HAS_TAKEN: { id: 'Tidak bisa dihapus karena sudah ada cuti yang terpakai', en: 'Cannot delete because leave has already been taken' },
  COMPANY_NOT_FOUND: { id: 'Perusahaan tidak ditemukan', en: 'Company not found' },
  USER_NOT_FOUND: { id: 'Karyawan tidak ditemukan', en: 'Employee not found' },
  EMAIL_TAKEN: { id: 'Email sudah digunakan', en: 'Email already in use' },
  NIP_TAKEN: { id: 'NIP sudah digunakan', en: 'NIP already in use' },
  PHONE_TAKEN: { id: 'Nomor telepon sudah digunakan', en: 'Phone number already in use' },
  POSITION_NOT_FOUND: { id: 'Posisi tidak ditemukan', en: 'Position not found' },
  SCHEDULE_NOT_FOUND: { id: 'Jadwal tidak ditemukan', en: 'Schedule not found' },
  LEAVE_TYPE_NOT_FOUND: { id: 'Tipe cuti tidak ditemukan', en: 'Leave type not found' },
  HOLIDAY_NOT_FOUND: { id: 'Hari libur tidak ditemukan', en: 'Holiday not found' },
  COMPANY_SETTINGS_NOT_FOUND: { id: 'Pengaturan perusahaan tidak ditemukan', en: 'Company settings not found' },
  CORRECTION_NOT_FOUND: { id: 'Data koreksi tidak ditemukan', en: 'Correction data not found' },
  CORRECTION_REASON_REQUIRED: { id: 'Alasan koreksi wajib diisi', en: 'Correction reason is required' },
  REPORT_INVALID_RANGE: { id: 'Rentang tanggal tidak valid', en: 'Invalid date range' },
  SUPERVISOR_SCOPE_DENIED: { id: 'Di luar lingkup bawahan Anda', en: 'Outside your subordinate scope' },
  DELETE_FAILED: { id: 'Gagal menghapus data', en: 'Failed to delete data' },
  SAVE_FAILED: { id: 'Gagal menyimpan data', en: 'Failed to save data' },
  INVALID_PASSWORD: { id: 'Password minimal 8 karakter', en: 'Password must be at least 8 characters' },
  CURRENT_PASSWORD_INVALID: { id: 'Password lama salah', en: 'Current password is incorrect' },
  NOTIFICATION_NOT_FOUND: { id: 'Notifikasi tidak ditemukan', en: 'Notification not found' },
  ATTENDANCE_NOT_FOUND: { id: 'Data absensi tidak ditemukan', en: 'Attendance data not found' },
  INVALID_ENUM: { id: 'Nilai tidak valid', en: 'Invalid value' },
  INVALID_DATE_FORMAT: { id: 'Format tanggal harus YYYY-MM-DD', en: 'Date format must be YYYY-MM-DD' },
  JSON_INVALID: { id: 'Format JSON tidak valid', en: 'Invalid JSON format' },

  // notifications (title/body stored as keys + params, rendered at read)
  NOTIF_LEAVE_SUBMITTED_TITLE: { id: 'Pengajuan Cuti Baru', en: 'New Leave Request' },
  NOTIF_LEAVE_SUBMITTED_LEAD_BODY: { id: '{name} baru saja mengajukan cuti', en: '{name} just submitted a leave request' },
  NOTIF_LEAVE_SUBMITTED_ROLE_BODY: { id: '{name} mengajukan cuti', en: '{name} submitted a leave request' },
  NOTIF_REPLACEMENT_SUBMITTED_TITLE: { id: 'Pengajuan Replacement Off Baru', en: 'New Replacement Off Request' },
  NOTIF_REPLACEMENT_SUBMITTED_BODY: { id: '{name} mengajukan replacement off', en: '{name} submitted a replacement off' },
  NOTIF_STATUS_TITLE_LEAVE: { id: 'Status Cuti Diperbarui', en: 'Leave Status Updated' },
  NOTIF_STATUS_TITLE_REPLACEMENT: { id: 'Status Replacement Off Diperbarui', en: 'Replacement Off Status Updated' },
  NOTIF_STATUS_BODY_APPROVED: { id: 'Pengajuan Anda disetujui', en: 'Your request has been approved' },
  NOTIF_STATUS_BODY_REJECTED: { id: 'Pengajuan Anda ditolak', en: 'Your request has been rejected' },
  NOTIF_STATUS_BODY_WAITING_HR: { id: 'Pengajuan Anda menunggu persetujuan HR', en: 'Your request is awaiting HR approval' },
  NOTIF_HR_WAITING_TITLE: { id: 'Pengajuan Menunggu Persetujuan HR', en: 'Request Awaiting HR Approval' },
  NOTIF_HR_WAITING_BODY_LEAVE: { id: 'Pengajuan Cuti menunggu persetujuan HR', en: 'Leave request awaiting HR approval' },
  NOTIF_HR_WAITING_BODY_REPLACEMENT: { id: 'Pengajuan Replacement Off menunggu persetujuan HR', en: 'Replacement Off request awaiting HR approval' },
};

export function t(code: string, locale: Locale = 'id', params?: Record<string, string | number>): string {
  const entry = MESSAGES[code];
  if (!entry) return code;
  let msg = entry[locale] ?? entry.id ?? code;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      msg = msg.split(`{${key}}`).join(String(value));
    }
  }
  return msg;
}

export function resolveLocale(header?: string, userPref?: string | null): Locale {
  if (userPref === 'en' || userPref === 'id') return userPref;
  if (!header) return 'id';
  const parts = header.split(',').map((p) => p.split(';')[0].trim().toLowerCase());
  for (const p of parts) {
    if (p === 'en') return 'en';
    if (p === 'id') return 'id';
  }
  return 'id';
}
