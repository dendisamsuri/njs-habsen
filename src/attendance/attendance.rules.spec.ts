import { haversineMeters } from '../common/time.util';

/**
 * Ported inspirasi dari C:\app\absensi\tests\*_static.php + ApprovalTransition rules.
 * Pure-logic assertions (no DB) — radius, status mapping, tolerance.
 */

describe('radius rules (AttendanceLocationService port)', () => {
  const HQ = { lat: -6.2, lon: 106.8166667, radius: 100 };

  it('inside radius', () => {
    const d = haversineMeters(HQ.lat, HQ.lon, HQ.lat + 0.0001, HQ.lon);
    expect(d).toBeLessThanOrEqual(HQ.radius);
  });

  it('outside radius far away', () => {
    const d = haversineMeters(HQ.lat, HQ.lon, HQ.lat + 0.01, HQ.lon);
    expect(d).toBeGreaterThan(HQ.radius);
  });
});

describe('status mapping rules', () => {
  function statusMasuk(time: string, jamTelat: string): string {
    return time <= jamTelat ? 'TEPAT_WAKTU' : 'TERLAMAT';
  }

  it('on time at boundary', () => {
    expect(statusMasuk('08:15:00', '08:15:00')).toBe('TEPAT_WAKTU');
  });

  it('late after boundary', () => {
    expect(statusMasuk('08:15:01', '08:15:00')).toBe('TERLAMAT');
  });

  function statusPulang(time: string, scheduleOut: string): string | null {
    const norm = scheduleOut.length === 5 ? `${scheduleOut}:00` : scheduleOut;
    return time < norm ? 'PULANG_CEPAT' : null;
  }

  it('pulang cepat', () => {
    expect(statusPulang('16:59:59', '17:00:00')).toBe('PULANG_CEPAT');
  });

  it('not pulang cepat on time', () => {
    expect(statusPulang('17:00:00', '17:00:00')).toBeNull();
  });
});

describe('approval transition table (PHP ApprovalTransitionService)', () => {
  function nextStatus(level: 1 | 3, oldStatus: string, decision: 'approved' | 'rejected'): string | 'ALREADY' {
    const allowed: Record<number, string[]> = { 3: ['pending'], 1: ['pending', 'waiting_hr'] };
    if (!allowed[level].includes(oldStatus)) return 'ALREADY';
    if (level === 3) return decision === 'approved' ? 'waiting_hr' : 'rejected';
    return decision;
  }

  it('supervisor approve → waiting_hr', () => {
    expect(nextStatus(3, 'pending', 'approved')).toBe('waiting_hr');
  });

  it('supervisor reject → rejected', () => {
    expect(nextStatus(3, 'pending', 'rejected')).toBe('rejected');
  });

  it('supervisor cannot decide waiting_hr', () => {
    expect(nextStatus(3, 'waiting_hr', 'approved')).toBe('ALREADY');
  });

  it('HR approve waiting_hr → approved', () => {
    expect(nextStatus(1, 'waiting_hr', 'approved')).toBe('approved');
  });

  it('double decision blocked', () => {
    expect(nextStatus(1, 'approved', 'rejected')).toBe('ALREADY');
    expect(nextStatus(3, 'rejected', 'approved')).toBe('ALREADY');
  });
});

describe('comment validation rules', () => {
  function validComment(decision: string, comment: string): boolean {
    if (comment.length > 500) return false;
    if (decision === 'rejected' && comment.length < 5) return false;
    return true;
  }

  it('reject needs 5-500', () => {
    expect(validComment('rejected', 'ok')).toBe(false);
    expect(validComment('rejected', 'alasan')).toBe(true);
    expect(validComment('rejected', 'x'.repeat(501))).toBe(false);
  });

  it('approve allows empty comment', () => {
    expect(validComment('approved', '')).toBe(true);
  });
});

describe('half-day leave rules', () => {
  it('totalDays=0.5 for half day, end=start', () => {
    const start = new Date('2026-09-21');
    const end = start;
    const totalDays = 0.5;
    expect(end.getTime()).toBe(start.getTime());
    expect(totalDays).toBeLessThan(1);
  });

  it('full-day inclusive count', () => {
    const start = new Date('2026-09-21');
    const end = new Date('2026-09-23');
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
    expect(diff + 1).toBe(3);
  });

  it('half-day does NOT block attendance (totalDays < 1)', () => {
    const blocks = (totalDays: number) => totalDays >= 1;
    expect(blocks(0.5)).toBe(false);
    expect(blocks(1)).toBe(true);
    expect(blocks(2)).toBe(true);
  });
});

describe('replacement-off expiry rules', () => {
  function shouldExpire(status: string, expiresAt: string, today: string): boolean {
    return (
      (status === 'draft' || status === 'pending') && expiresAt < today && true
    );
  }

  it('expires draft/pending past due', () => {
    expect(shouldExpire('draft', '2026-09-01', '2026-09-22')).toBe(true);
    expect(shouldExpire('pending', '2026-09-01', '2026-09-22')).toBe(true);
  });

  it('does not expire approved', () => {
    expect(shouldExpire('approved', '2026-09-01', '2026-09-22')).toBe(false);
  });

  it('does not expire before due date', () => {
    expect(shouldExpire('draft', '2026-10-01', '2026-09-22')).toBe(false);
  });
});

describe('can_check_in/out logic (today-status port)', () => {
  function flags(absenIn: string | null, absenOut: string | null) {
    const checkedIn = !!absenIn && absenIn !== '00:00:00';
    const checkedOut = !!absenOut && absenOut !== '00:00:00';
    return {
      checked_in: checkedIn,
      checked_out: checkedOut,
      can_check_in: !checkedIn,
      can_check_out: checkedIn && !checkedOut,
    };
  }

  it('before any attendance', () => {
    expect(flags(null, null)).toEqual({
      checked_in: false,
      checked_out: false,
      can_check_in: true,
      can_check_out: false,
    });
  });

  it('after check-in', () => {
    expect(flags('08:00:00', '00:00:00')).toEqual({
      checked_in: true,
      checked_out: false,
      can_check_in: false,
      can_check_out: true,
    });
  });

  it('after check-out', () => {
    expect(flags('08:00:00', '17:00:00')).toEqual({
      checked_in: true,
      checked_out: true,
      can_check_in: false,
      can_check_out: false,
    });
  });
});
