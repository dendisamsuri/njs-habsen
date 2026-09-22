import {
  haversineMeters,
  parseCoords,
  todayIso,
  nowHms,
  addDaysIso,
  dateRange,
  dayName,
  isSentinelTime,
  hhmm,
} from './time.util';
import { resolveLocale, t } from '../i18n/messages';

describe('time.util', () => {
  it('haversine ~0 for same point', () => {
    expect(haversineMeters(-6.2, 106.8, -6.2, 106.8)).toBeCloseTo(0, 5);
  });

  it('haversine known distance roughly correct', () => {
    // ~111km per degree lat
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('parseCoords valid', () => {
    expect(parseCoords('-6.2', '106.8')).toEqual({ lat: -6.2, lon: 106.8 });
  });

  it('parseCoords out of range', () => {
    expect(parseCoords(91, 0)).toEqual({ lat: null, lon: null });
  });

  it('todayIso format', () => {
    expect(todayIso(new Date(2026, 8, 22))).toBe('2026-09-22');
  });

  it('nowHms padded', () => {
    expect(nowHms(new Date(2026, 0, 1, 7, 5, 3))).toBe('07:05:03');
  });

  it('addDaysIso month rollover', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('dateRange inclusive', () => {
    const days = [...dateRange('2026-09-21', '2026-09-23')];
    expect(days).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
  });

  it('dayName', () => {
    expect(dayName('2026-09-22')).toBe('TUESDAY'); // Tue Sep 22 2026
  });

  it('sentinel time', () => {
    expect(isSentinelTime('00:00:00')).toBe(true);
    expect(isSentinelTime(null)).toBe(true);
    expect(isSentinelTime('08:00:00')).toBe(false);
  });

  it('hhmm null for sentinel', () => {
    expect(hhmm('00:00:00')).toBeNull();
    expect(hhmm('08:30:00')).toBe('08:30');
  });
});

describe('i18n', () => {
  it('resolveLocale default id', () => {
    expect(resolveLocale(undefined)).toBe('id');
    expect(resolveLocale('en-US,en;q=0.9')).toBe('en');
    expect(resolveLocale('id-ID,id;q=0.9')).toBe('id');
  });

  it('same code different locale messages', () => {
    expect(t('INVALID_CREDENTIALS', 'id')).not.toBe(t('INVALID_CREDENTIALS', 'en'));
    expect(t('UNKNOWN_CODE', 'id')).toBe('UNKNOWN_CODE');
  });
});
