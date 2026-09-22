import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { err } from '../common/exceptions';

const DATA_URI_RE = /^data:image\/(jpeg|jpg|png);base64,/;
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class AttendancePhotoService {
  /**
   * Port of AttendancePhotoService::upload — accepts data-URI base64,
   * stores under uploads/absen/, returns basename.
   * No re-encode (no GD); validates PNG/JPEG magic bytes instead.
   */
  async upload(dataUri: string, userId: number, type: 'masuk' | 'pulang'): Promise<string> {
    if (typeof dataUri !== 'string' || !DATA_URI_RE.test(dataUri)) {
      throw err('PHOTO_INVALID_TYPE', 400);
    }
    const b64 = dataUri.slice(dataUri.indexOf(',') + 1).replace(/ /g, '+');
    if (b64.length > Math.ceil(MAX_BYTES / 3) * 4) {
      throw err('PHOTO_TOO_LARGE', 400);
    }
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 1024 || buf.length > MAX_BYTES) {
      throw err('PHOTO_REQUIRED', 400);
    }
    if (!this.isJpegOrPng(buf)) {
      throw err('PHOTO_INVALID_TYPE', 400);
    }
    const dir = path.join(process.env.UPLOAD_DIR ?? 'uploads', 'absen');
    await fs.mkdir(dir, { recursive: true });
    const suffix = randomBytes(8).toString('hex');
    const filename = `absen-${type}-${userId}-${Date.now()}-${suffix}.jpg`;
    await fs.writeFile(path.join(dir, filename), buf);
    return filename;
  }

  private isJpegOrPng(buf: Buffer): boolean {
    if (buf.length > 8 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    if (
      buf.length > 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    )
      return true;
    return false;
  }

  async cleanup(basename: string): Promise<void> {
    if (!basename || basename.includes('..') || basename.includes('/') || basename.includes('\\')) return;
    if (!/^absen-(masuk|pulang)-[A-Za-z0-9_-]+-\d+-[a-f0-9]{16}\.jpg$/.test(basename)) return;
    try {
      await fs.unlink(path.join(process.env.UPLOAD_DIR ?? 'uploads', 'absen', basename));
    } catch {
      // ignore
    }
  }
}
