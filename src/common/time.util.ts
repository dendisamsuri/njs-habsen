export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function parseCoords(
  latitude?: string | number | null,
  longitude?: string | number | null,
): { lat: number | null; lon: number | null } {
  if (latitude !== undefined && latitude !== null && `${latitude}`.length > 0) {
    const lat = Number(latitude);
    if (longitude !== undefined && longitude !== null && `${longitude}`.length > 0) {
      const lon = Number(longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return { lat: null, lon: null };
        return { lat, lon };
      }
      return { lat: null, lon: null };
    }
    // single "lat,lon" field fallback
    const parts = `${latitude}`.replace(/\s/g, '').split(',');
    if (parts.length >= 2) {
      const la = Number(parts[0]);
      const lo = Number(parts[1]);
      if (Number.isFinite(la) && Number.isFinite(lo)) return { lat: la, lon: lo };
    }
    return { lat: null, lon: null };
  }
  return { lat: null, lon: null };
}

/** ISO date helpers (YYYY-MM-DD, no TZ shift) */
export function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowHms(d = new Date()): string {
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0') +
    ':' +
    String(d.getSeconds()).padStart(2, '0')
  );
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return todayIso(dt);
}

export function* dateRange(startIso: string, endIso: string): Generator<string> {
  let cur = startIso;
  while (cur <= endIso) {
    yield cur;
    cur = addDaysIso(cur, 1);
  }
}

export function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun
}

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

export function dayName(iso: string): string {
  return DAY_NAMES[dayOfWeek(iso)];
}

export function hhmm(t?: string | null): string | null {
  if (!t || t === '00:00:00' || t === '00:00') return null;
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export function isSentinelTime(t?: string | null): boolean {
  return !t || t === '00:00:00' || t === '00:00' || t === '';
}

/** lexicographic HH:MM:SS compare */
export function timeLe(a: string, b: string): boolean {
  return a <= b;
}
export function timeLt(a: string, b: string): boolean {
  return a < b;
}

export function normalizeTimeInput(t: string): string {
  if (t.length === 5) return `${t}:00`;
  return t;
}

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function tanggalInd(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS_ID[dt.getDay()]}, ${d} ${MONTHS_ID[m - 1]} ${y}`;
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
