import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { AttendanceService } from './attendance.service';
import { AttendanceLocationService } from './attendance-location.service';
import { Public } from '../common/jwt-auth.guard';
import { err } from '../common/exceptions';

const DATA_URI_RE = /^data:image\/(jpeg|jpg|png);base64,/;

class CheckInDto {
  @IsNotEmpty() latitude!: number | string;
  @IsNotEmpty() longitude!: number | string;
  @IsOptional() schedule_id?: number;
  @IsOptional() @IsString() img?: string;
  @IsOptional() @IsString() tipe?: string;
  @IsOptional() @IsString() flow_id?: string;
}

class CheckOutDto {
  @IsNotEmpty() latitude!: number | string;
  @IsNotEmpty() longitude!: number | string;
  @IsOptional() @IsString() img?: string;
  @IsOptional() @IsString() tipe?: string;
  @IsOptional() @IsString() flow_id?: string;
}

class CheckLocationDto {
  @IsNotEmpty() latitude!: number | string;
  @IsNotEmpty() longitude!: number | string;
}

@Controller()
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly locations: AttendanceLocationService,
  ) {}

  private validateCoords(latRaw: any, lonRaw: any): { lat: number; lon: number } {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (latRaw === '' || latRaw === null || latRaw === undefined || !Number.isFinite(lat)) {
      throw err('COORDINATES_REQUIRED', 400);
    }
    if (lonRaw === '' || lonRaw === null || lonRaw === undefined || !Number.isFinite(lon)) {
      throw err('COORDINATES_REQUIRED', 400);
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw err('COORDINATES_INVALID', 400);
    }
    return { lat, lon };
  }

  @Get('attendance/today')
  today(@Req() req: any) {
    return this.attendance.today(req.user);
  }

  @Get('attendance/history')
  history(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.attendance.history(
      req.user,
      limit ? Number(limit) : 30,
      offset ? Number(offset) : 0,
    );
  }

  @Post('attendance/in')
  @HttpCode(200)
  async checkIn(@Req() req: any, @Body() dto: CheckInDto) {
    const { lat, lon } = this.validateCoords(dto.latitude, dto.longitude);
    if (!dto.img) throw err('PHOTO_REQUIRED', 400);
    if (!DATA_URI_RE.test(dto.img)) throw err('PHOTO_INVALID_TYPE', 400);
    const result = await this.attendance.checkIn(req.user, {
      latitude: lat,
      longitude: lon,
      schedule_id: Number(dto.schedule_id ?? 0),
      img: dto.img,
      tipe: dto.tipe ?? 'selfie',
      flow_id: dto.flow_id,
    });
    return result;
  }

  @Post('attendance/out')
  @HttpCode(200)
  async checkOut(@Req() req: any, @Body() dto: CheckOutDto) {
    const { lat, lon } = this.validateCoords(dto.latitude, dto.longitude);
    if (!dto.img) throw err('PHOTO_REQUIRED', 400);
    if (!DATA_URI_RE.test(dto.img)) throw err('PHOTO_INVALID_TYPE', 400);
    return this.attendance.checkOut(req.user, {
      latitude: lat,
      longitude: lon,
      img: dto.img,
      tipe: dto.tipe ?? 'selfie',
      flow_id: dto.flow_id,
    });
  }
}

@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: AttendanceLocationService) {}

  @Get()
  async all(
    @Req() req: any,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('lat') latAlias?: string,
    @Query('lon') lonAlias?: string,
    @Query('lng') lngAlias?: string,
  ) {
    const lat = latitude ?? latAlias;
    const lon = longitude ?? lonAlias ?? lngAlias;
    const c = (this.locations as any).c();
    const rows = await c.location.findMany({
      where: { companyId: req.user.companyId, status: 'Y' },
      orderBy: { name: 'asc' },
    });
    let list = rows.map((r: any) => ({
      lokasi_id: r.id,
      id: r.id,
      code: r.code,
      lokasi_nama: r.name,
      name: r.name,
      lokasi_latitude: Number(r.latitude),
      latitude: Number(r.latitude),
      lokasi_longitude: Number(r.longitude),
      longitude: Number(r.longitude),
      lokasi_radius: r.radiusMeters,
      radius_meters: r.radiusMeters,
    }));
    if (lat !== undefined && lat !== '' && lon !== undefined && lon !== '') {
      const la = Number(lat);
      const lo = Number(lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
        throw err('COORDINATES_INVALID', 400);
      }
      const { haversineMeters } = await import('../common/time.util');
      list = list
        .map((item: any) => ({
          ...item,
          distance_meters:
            Math.round(haversineMeters(la, lo, item.lokasi_latitude, item.lokasi_longitude) * 100) / 100,
        }))
        .sort((a: any, b: any) => a.distance_meters - b.distance_meters);
    }
    return list;
  }

  @Post('check')
  @HttpCode(200)
  async check(@Req() req: any, @Body() dto: CheckLocationDto) {
    const lat = Number(dto.latitude);
    const lon = Number(dto.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw err('COORDINATES_INVALID', 400);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw err('COORDINATES_INVALID', 400);
    const result = await this.locations.check(
      req.user.companyId!,
      req.user.isFlexibleLocation === true,
      lat,
      lon,
    );
    return {
      in_radius: result.ok,
      distance: result.distanceMeters,
      is_flexible: result.flexible,
      location_name: result.locationName,
      distance_meters: result.distanceMeters !== null ? Math.round(result.distanceMeters * 100) / 100 : null,
      radius_meters: result.radiusMeters,
    };
  }
}
