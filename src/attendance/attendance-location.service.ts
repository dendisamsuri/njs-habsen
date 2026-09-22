import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/prisma.module';
import { haversineMeters, parseCoords } from '../common/time.util';

export interface LocationCheckResult {
  ok: boolean;
  flexible: boolean;
  locationId: number | null;
  locationName: string | null;
  distanceMeters: number | null;
  radiusMeters: number | null;
}

@Injectable()
export class AttendanceLocationService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private c() {
    return (this.prisma as any).scoped();
  }

  /** Port of AttendanceLocationService::checkLocation */
  async check(
    companyId: number,
    isFlexibleUser: boolean,
    latitude?: number | string | null,
    longitude?: number | string | null,
  ): Promise<LocationCheckResult> {
    const { lat, lon } = parseCoords(latitude, longitude);
    if (lat === null || lon === null) {
      return {
        ok: false,
        flexible: false,
        locationId: null,
        locationName: null,
        distanceMeters: null,
        radiusMeters: null,
      };
    }

    if (isFlexibleUser) {
      return {
        ok: true,
        flexible: true,
        locationId: 0,
        locationName: 'Flexible location',
        distanceMeters: 0,
        radiusMeters: 999999,
      };
    }

    const rows = await this.c().location.findMany({
      where: { companyId, status: 'Y' },
    });

    let nearestId: number | null = null;
    let nearestName: string | null = null;
    let nearestDist: number | null = null;
    let nearestRadius: number | null = null;

    for (const row of rows) {
      const la = Number(row.latitude);
      const lo = Number(row.longitude);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
      if (row.latitude === null || row.longitude === null) continue;
      const dist = haversineMeters(lat, lon, la, lo);
      if (nearestDist === null || dist < nearestDist) {
        nearestDist = dist;
        nearestId = row.id;
        nearestName = row.name;
        nearestRadius = row.radiusMeters;
      }
      if (dist <= row.radiusMeters) {
        return {
          ok: true,
          flexible: false,
          locationId: row.id,
          locationName: row.name,
          distanceMeters: dist,
          radiusMeters: row.radiusMeters,
        };
      }
    }

    return {
      ok: false,
      flexible: false,
      locationId: nearestId,
      locationName: nearestName,
      distanceMeters: nearestDist,
      radiusMeters: nearestRadius,
    };
  }

  /** Port of getLocationName — nearest, threshold 100 m, else "Di luar area (X.X km)". */
  async getLocationName(companyId: number, lat: number | null, lon: number | null): Promise<string> {
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return '-';
    const rows = await this.c().location.findMany({ where: { companyId, status: 'Y' } });
    let min = Infinity;
    let name = '-';
    for (const row of rows) {
      const la = Number(row.latitude);
      const lo = Number(row.longitude);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
      const dist = haversineMeters(lat, lon, la, lo);
      if (dist < min) {
        min = dist;
        if (dist <= 100) name = row.name;
        else name = `Di luar area (${(dist / 1000).toFixed(1)} km)`;
      }
    }
    return name;
  }
}
