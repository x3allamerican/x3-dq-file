import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDqFile, dueList, type DriverFile } from '../src/index.ts';

const GOOD: DriverFile = {
  driver: 'EMP-1001', hireDate: '2024-03-04', cdl: true, application: '2024-02-20', preEmploymentMvr: '2024-02-21', safetyPerformanceHistory: '2024-03-20',
  roadTest: { date: '2024-02-22', kind: 'cdl-equivalent' }, annualMvr: ['2025-02-28', '2026-02-27'], annualReview: ['2025-03-03', '2026-03-02'],
  medicalCert: { issued: '2025-05-01', expires: '2027-05-01' }, cdlisMedicalMvr: '2025-05-10', clearinghousePreEmployment: '2024-02-21', clearinghouseAnnual: ['2025-02-28', '2026-02-27'],
};
const state = (r: ReturnType<typeof checkDqFile>, item: string) => r.items.find((i) => i.item.startsWith(item))!.state;

test('a complete file passes', () => {
  const r = checkDqFile(GOOD, '2026-11-14');
  assert.deepEqual(r.items.filter((i) => i.state !== 'ok').map((i) => i.item), []);
  assert.deepEqual(r.blocking, []);
  assert.equal(r.score.ok, r.score.total);
});

test('30-day inquiries: late, missing, and still within the window (391.23)', () => {
  assert.equal(state(checkDqFile({ ...GOOD, safetyPerformanceHistory: '2024-04-10' }, '2026-11-14'), 'Safety performance'), 'late');
  assert.equal(state(checkDqFile({ ...GOOD, preEmploymentMvr: undefined }, '2026-11-14'), 'Pre-employment MVR'), 'missing');
  const newHire = checkDqFile({ ...GOOD, hireDate: '2026-11-01', preEmploymentMvr: undefined, annualMvr: [], annualReview: [], clearinghouseAnnual: [], clearinghousePreEmployment: '2026-10-30' }, '2026-11-14');
  const mvr = newHire.items.find((i) => i.item.startsWith('Pre-employment MVR'))!;
  assert.deepEqual([mvr.state, mvr.nextDue], ['due-soon', '2026-12-01']);
  assert.equal(state(newHire, 'Annual MVR'), 'ok');
});

test('annual MVR, review and Clearinghouse query: due soon and overdue (391.25, 382.701(b))', () => {
  const r = checkDqFile(GOOD, '2027-02-10');
  assert.equal(state(r, 'Annual MVR'), 'due-soon');
  assert.equal(r.items.find((i) => i.item === 'Annual MVR inquiry')!.nextDue, '2027-02-27');
  const late = checkDqFile(GOOD, '2027-03-15');
  assert.equal(state(late, 'Annual MVR'), 'overdue');
  assert.equal(state(late, 'Annual review'), 'overdue');
  assert.equal(state(late, 'Clearinghouse annual'), 'overdue');
});

test('medical certificate expiring and expired blocks driving (391.45)', () => {
  assert.equal(state(checkDqFile(GOOD, '2027-04-15'), 'Medical'), 'due-soon');
  const r = checkDqFile(GOOD, '2027-05-02');
  assert.equal(state(r, 'Medical'), 'expired');
  assert.equal(r.blocking.length, 1);
  assert.match(checkDqFile({ ...GOOD, medicalCert: { issued: '2025-05-01', expires: '2027-12-01' } }, '2026-01-01').items.find((i) => i.item.startsWith('Medical'))!.detail, /more than 24 months/);
});

test('CDL vs non-CDL medical paperwork (391.51(b)(6)(ii), (b)(8)(i))', () => {
  assert.equal(state(checkDqFile({ ...GOOD, cdlisMedicalMvr: undefined }, '2026-11-14'), 'CDLIS MVR'), 'missing');
  const nonCdl = checkDqFile({ ...GOOD, cdl: false, cdlisMedicalMvr: undefined, clearinghousePreEmployment: undefined, clearinghouseAnnual: undefined }, '2026-11-14');
  assert.equal(state(nonCdl, 'National Registry'), 'missing');
  assert.ok(!nonCdl.items.some((i) => i.item.startsWith('Clearinghouse')));
});

test('Clearinghouse pre-employment query after hire is late; missing blocks (382.701(a))', () => {
  assert.equal(state(checkDqFile({ ...GOOD, clearinghousePreEmployment: '2024-03-05' }, '2026-11-14'), 'Clearinghouse pre-employment'), 'late');
  assert.equal(checkDqFile({ ...GOOD, clearinghousePreEmployment: undefined }, '2026-11-14').blocking.length, 1);
});

test('retention and purge dates (391.51(c)-(d))', () => {
  const r = checkDqFile({ ...GOOD, annualMvr: ['2022-02-01', '2023-02-01', '2024-01-30', '2025-01-28', '2026-01-27'], terminatedOn: '2026-10-31' }, '2026-11-14');
  assert.equal(r.retainUntil, '2029-10-31');
  assert.deepEqual(r.purgeable.map((p) => p.date), ['2022-02-01', '2023-02-01']);
});

test('dueList across drivers, soonest first', () => {
  const list = dueList([GOOD, { ...GOOD, driver: 'EMP-1002', medicalCert: { issued: '2024-12-01', expires: '2026-12-01' } }], '2026-11-14', 60);
  assert.deepEqual(list.map((x) => [x.driver, x.item]), [['EMP-1002', 'Medical examiner\'s certificate']]);
});
