import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ThrottleEntry {
  windowStart: number;
  attempts: number;
  blockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
// Per-IP ceiling, higher than the per-account one, so spraying many emails from one
// source still burns out while a shared NAT office does not lock out after one typo.
const MAX_ATTEMPTS_PER_IP = 40;
const MAX_STORE = 5000;

@Injectable()
export class ThrottleService {
  private store = new Map<string, ThrottleEntry>();

  private key(scope: string, email: string, ip: string): string {
    if (scope === 'ip') return `ip|${ip || 'unknown'}`;
    return `acct|${email.toLowerCase().trim()}|${ip || 'unknown'}`;
  }

  private get(entry: ThrottleEntry | undefined): ThrottleEntry | undefined {
    if (!entry) return undefined;
    const now = Date.now();
    if (entry.windowStart < now - WINDOW_MS && entry.blockedUntil <= now) {
      return undefined;
    }
    return entry;
  }

  isBlocked(email: string, ip: string): number {
    const now = Date.now();
    let blocked = 0;
    for (const scope of ['acct', 'ip']) {
      const entry = this.get(this.store.get(this.key(scope, email, ip)));
      if (entry && entry.blockedUntil > now) {
        blocked = Math.max(blocked, Math.ceil((entry.blockedUntil - now) / 1000));
      }
    }
    return blocked;
  }

  private bump(scope: string, email: string, ip: string, max: number): void {
    const k = this.key(scope, email, ip);
    const now = Date.now();
    const entry = this.get(this.store.get(k)) ?? { windowStart: now, attempts: 0, blockedUntil: 0 };
    entry.attempts += 1;
    if (entry.attempts >= max) {
      const step = Math.min(5, entry.attempts - max);
      const blockSec = Math.min(900, 30 * (1 << step));
      entry.blockedUntil = now + blockSec * 1000;
      entry.windowStart = now;
    }
    this.store.set(k, entry);
  }

  recordFailure(email: string, ip: string): void {
    this.bump('acct', email, ip, MAX_ATTEMPTS);
    this.bump('ip', email, ip, MAX_ATTEMPTS_PER_IP);
    if (this.store.size > MAX_STORE) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
  }

  clear(email: string, ip: string): void {
    this.store.delete(this.key('acct', email, ip));
  }
}
