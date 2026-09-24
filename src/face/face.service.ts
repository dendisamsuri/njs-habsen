import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { TenantPrismaService } from '../prisma/prisma.module';
import { err } from '../common/exceptions';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DATA_URI_RE = /^data:image\/(jpeg|jpg|png);base64,/;

@Injectable()
export class FaceService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  private base(): string {
    return (process.env.FACE_RECOGNITION_URL ?? 'http://localhost:5001').replace(/\/+$/, '');
  }

  private timeoutSec(): number {
    const raw = (process.env.FACE_RECOGNITION_TIMEOUT ?? '10').replace(/\D/g, '');
    const n = Number(raw || '10');
    if (n < 2 || n > 60) return 10;
    return n;
  }

  decodeDataUri(dataUri: string): Buffer {
    if (typeof dataUri !== 'string' || !DATA_URI_RE.test(dataUri)) {
      throw err('PHOTO_INVALID_TYPE', 400);
    }
    const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
    if (b64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
      throw err('PHOTO_TOO_LARGE', 400);
    }
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 1024 || buf.length > MAX_IMAGE_BYTES) {
      throw err('PHOTO_REQUIRED', 400);
    }
    return buf;
  }

  private async httpPost(endpoint: string, body: unknown): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutSec() * 1000);
    try {
      const res = await fetch(`${this.base()}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw err('FACE_SERVICE_ERROR', 502);
      }
      if (!res.ok || json?.status !== 'success') {
        const code =
          typeof json?.error_code === 'string' ? json.error_code : null;
        if (
          res.status === 400 &&
          (code === 'FACE_NO_FACE_DETECTED' ||
            code === 'FACE_MULTIPLE_FACES')
        ) {
          throw err(code, 400);
        }
        throw err('FACE_SERVICE_ERROR', 502);
      }
      return json;
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.name === 'TypeError') {
        throw err('FACE_SERVICE_UNAVAILABLE', 503);
      }
      if (e?.errorCode) throw e;
      throw err('FACE_SERVICE_UNAVAILABLE', 503);
    } finally {
      clearTimeout(timer);
    }
  }

  async validateImage(image: Buffer): Promise<void> {
    await this.httpPost('/validate', { image: image.toString('base64') });
  }

  async verify(masterPath: string, probeDataUri: string): Promise<{ matched: boolean; similarity: number }> {
    const abs = path.isAbsolute(masterPath)
      ? masterPath
      : path.join(process.env.UPLOAD_DIR ?? 'uploads', masterPath);
    let masterBuf: Buffer;
    try {
      masterBuf = await fs.readFile(abs);
    } catch {
      throw err('FACE_NOT_REGISTERED', 400);
    }
    if (masterBuf.length < 1024 || masterBuf.length > MAX_IMAGE_BYTES) {
      throw err('FACE_SERVICE_ERROR', 502);
    }
    const probe = this.decodeDataUri(probeDataUri);
    const result = await this.httpPost('/verify', {
      master: masterBuf.toString('base64'),
      probe: probe.toString('base64'),
    });
    return { matched: result.matched === true, similarity: Number(result.similarity ?? 0) };
  }

  async status(companyId: number, userId: number) {
    const row = await this.c().faceRecognition.findFirst({
      where: { companyId, userId },
    });
    if (!row) {
      return { has_recognition: false, data: null };
    }
    return {
      has_recognition: true,
      data: {
        recognition_id: row.id,
        photo: row.photoPath,
        photo_url: `/api/v1/face/photo/${row.id}`,
      },
    };
  }

  async register(companyId: number, userId: number, img: string): Promise<any> {
    const c = this.c();
    const existing = await c.faceRecognition.findFirst({ where: { companyId, userId } });
    if (existing) throw err('FACE_ALREADY_REGISTERED', 400);

    const buf = this.decodeDataUri(img);
    await this.validateImage(buf).catch((e) => {
      throw e;
    });

    const dir = path.join(process.env.UPLOAD_DIR ?? 'uploads', 'face');
    await fs.mkdir(dir, { recursive: true });
    const filename = `face_${userId}_${Date.now()}_${randomBytes(4).toString('hex')}.jpg`;
    // re-encode not possible without sharp — store original bytes when jpg/png
    await fs.writeFile(path.join(dir, filename), buf);

    const row = await c.faceRecognition.create({
      data: { companyId, userId, photoPath: `face/${filename}` },
    });
    await c.user.update({ where: { id: userId }, data: { faceRegistered: true } });
    return {
      recognition_id: row.id,
      photo: row.photoPath,
      photo_url: `/api/v1/face/photo/${row.id}`,
    };
  }

  async remove(companyId: number, userId: number): Promise<boolean> {
    const c = this.c();
    const row = await c.faceRecognition.findFirst({ where: { companyId, userId } });
    if (!row) throw err('FACE_NOT_REGISTERED', 404);
    await c.faceRecognition.delete({ where: { id: row.id } });
    await c.user.update({ where: { id: userId }, data: { faceRegistered: false } });
    try {
      await fs.unlink(path.join(process.env.UPLOAD_DIR ?? 'uploads', row.photoPath));
    } catch {
      // ignore missing file
    }
    return true;
  }

  async photoFile(id: number): Promise<{ abs: string }> {
    const row = await this.prisma.faceRecognition.findUnique({ where: { id } });
    if (!row) throw err('NOT_FOUND', 404);
    return { abs: path.join(process.env.UPLOAD_DIR ?? 'uploads', row.photoPath) };
  }
}
