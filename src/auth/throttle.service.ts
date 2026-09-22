import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ThrottleEntry {
  windowStart: number;
  attempts: number;
  blockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class ThrottleService {
  private store = new Map<string, ThrottleEntry>();

  private key(email: string, ip: string): string {
    return `${email.toLowerCase().trim()}|${ip || 'unknown'}`;
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
    const entry = this.get(this.store.get(this.key(email, ip)));
    if (!entry) return 0;
    const now = Date.now();
    if (entry.blockedUntil > now) {
      return Math.ceil((entry.blockedUntil - now) / 1000);
    }
    return 0;
  }

  recordFailure(email: string, ip: string): void {
    const k = this.key(email, ip);
    const now = Date.now();
    let entry = this.get(this.store.get(k));
    if (!entry) {
      entry = { windowStart: now, attempts: 0, blockedUntil: 0 };
    }
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      const step = Math.min(5, entry.attempts - MAX_ATTEMPTS);
      const blockSec = Math.min(900, 30 * (1 << step));
      entry.blockedUntil = now + blockSec * 1000;
      entry.windowStart = now;
    }
    this.store.set(k, entry);
    // eviction bound
    if (this.store.size > 5000) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
  }

  clear(email: string, ip: string): void {
    this.store.delete(this.key(email, ip));
  }
}
