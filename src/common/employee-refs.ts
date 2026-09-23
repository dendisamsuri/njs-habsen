import { err } from './exceptions';

interface EmployeeRefs {
  position_id?: number | null;
  location_id?: number | null;
  schedule_id?: number | null;
  schedule_ids?: number[];
  direct_lead_id?: number | null;
}

export async function assertEmployeeRefs(c: any, companyId: number, refs: EmployeeRefs): Promise<void> {
  const checks: Array<[string, Promise<any>]> = [];
  if (typeof refs.position_id === 'number')
    checks.push(['POSITION_NOT_FOUND', c.position.findFirst({ where: { id: refs.position_id, companyId } })]);
  if (typeof refs.location_id === 'number')
    checks.push(['LOCATION_NOT_FOUND', c.location.findFirst({ where: { id: refs.location_id, companyId } })]);
  if (typeof refs.schedule_id === 'number')
    checks.push(['SCHEDULE_NOT_FOUND', c.schedule.findFirst({ where: { id: refs.schedule_id, companyId } })]);
  if (Array.isArray(refs.schedule_ids) && refs.schedule_ids.length > 0) {
    const ids = refs.schedule_ids;
    checks.push([
      'SCHEDULE_NOT_FOUND',
      c.schedule.findMany({ where: { id: { in: ids }, companyId } }).then((rows: any[]) => (rows.length === ids.length ? rows[0] : null)),
    ]);
  }
  if (typeof refs.direct_lead_id === 'number')
    checks.push(['USER_NOT_FOUND', c.user.findFirst({ where: { id: refs.direct_lead_id, companyId, deletedAt: null } })]);
  for (const [code, check] of checks) {
    if (!(await check)) throw err(code, 400);
  }
}
