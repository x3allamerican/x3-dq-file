/**
 * X3 DQ File: check a driver qualification file against 49 CFR 391.51 and the deadlines behind it
 * (391.21, 391.23, 391.25, 391.31/391.33, 391.43/391.45, 382.701). Says what is missing, late, expiring or
 * overdue, when each item is next due, and what may be purged and when.
 */

export interface DriverFile {
  driver: string;
  /** Date employment began (YYYY-MM-DD). */
  hireDate: string;
  /** Holds a CDL (subject to Part 382 testing and the Clearinghouse, CDLIS medical status). */
  cdl: boolean;
  terminatedOn?: string;
  application?: string;
  /** Pre-employment MVR from each state licensed in the last 3 years (391.23(a)(1)). */
  preEmploymentMvr?: string;
  /** Safety performance history replies or good-faith-effort record (391.23(a)(2), (c)). */
  safetyPerformanceHistory?: string;
  /** Road test certificate, or the license/certificate accepted as equivalent (391.31(e), 391.33). */
  roadTest?: { date: string; kind: 'certificate' | 'cdl-equivalent' | 'other-equivalent' | '391.44-statement' };
  /** Each annual MVR inquiry date (391.25(a)). */
  annualMvr?: string[];
  /** Each annual review note date (391.25(b), (c)(2)). */
  annualReview?: string[];
  medicalCert?: { issued: string; expires: string };
  /** CDL holders: date of the CDLIS MVR showing medical certification status (391.51(b)(6)(ii)). */
  cdlisMedicalMvr?: string;
  /** Non-CDL drivers: date of the National Registry verification note (391.23(m)(1), 391.51(b)(8)(i)). */
  nationalRegistryNote?: string;
  /** SPE certificate or medical exemption, if the driver needs one (391.49, Part 381). */
  medicalVariance?: { needed: boolean; date?: string; expires?: string };
  /** CDL drivers: Clearinghouse pre-employment full query (382.701(a)). */
  clearinghousePreEmployment?: string;
  /** CDL drivers: each annual Clearinghouse query (382.701(b)). */
  clearinghouseAnnual?: string[];
}

export type ItemState = 'ok' | 'missing' | 'late' | 'due-soon' | 'overdue' | 'expired' | 'n/a';

export interface CheckItem {
  item: string;
  state: ItemState;
  detail: string;
  /** Next date something is due, if recurring or expiring. */
  nextDue?: string;
  citation: string;
}

export interface DqResult {
  driver: string;
  asOf: string;
  items: CheckItem[];
  /** Items that make the driver not qualified to drive right now. */
  blocking: string[];
  score: { ok: number; total: number };
  /** When the whole file may be destroyed (3 years after employment ends), if terminated. */
  retainUntil?: string;
  /** Older copies of recurring records that may be removed (3 years after execution, 391.51(d)). */
  purgeable: Array<{ item: string; date: string; removableAfter: string }>;
}

const D = (s: string) => {
  const t = Date.parse(`${s.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t)) throw new Error(`"${s}" is not a date (YYYY-MM-DD).`);
  return t;
};
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(D(s) + n * 86_400_000);
function addMonths(s: string, n: number): string {
  const d = new Date(D(s));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d.getTime());
}
const latest = (xs?: string[]) => (xs?.length ? [...xs].sort().at(-1) : undefined);

/** Check one driver's qualification file. `soonDays` sets when an expiring or recurring item counts as due soon (default 30). */
export function checkDqFile(f: DriverFile, asOf: string, opts: { soonDays?: number } = {}): DqResult {
  const soon = opts.soonDays ?? 30;
  const items: CheckItem[] = [];
  const push = (i: CheckItem) => items.push(i);
  const within30 = addDays(f.hireDate, 30);
  const employedMonths = (D(asOf) - D(f.hireDate)) / (86_400_000 * 30.44);

  push(f.application
    ? { item: 'Employment application', state: 'ok', detail: `Dated ${f.application}.`, citation: '49 CFR 391.51(b)(1), 391.21' }
    : { item: 'Employment application', state: 'missing', detail: 'No completed application on file.', citation: '49 CFR 391.51(b)(1), 391.21' });

  const timed = (name: string, date: string | undefined, cite: string) => {
    if (!date) {
      const overdue = asOf > within30;
      push({ item: name, state: overdue ? 'missing' : 'due-soon', detail: overdue ? `Not on file; it was due by ${within30}, 30 days after hire.` : `Due by ${within30}, 30 days after hire.`, nextDue: within30, citation: cite });
    } else push({ item: name, state: date > within30 ? 'late' : 'ok', detail: date > within30 ? `Obtained ${date}, after the 30-day deadline (${within30}).` : `Obtained ${date}.`, citation: cite });
  };
  timed('Pre-employment MVR (each state, 3 years)', f.preEmploymentMvr, '49 CFR 391.23(a)(1), 391.51(b)(2)');
  timed('Safety performance history (previous DOT employers, 3 years)', f.safetyPerformanceHistory, '49 CFR 391.23(a)(2), (c)');

  push(f.roadTest
    ? { item: 'Road test certificate or equivalent', state: 'ok', detail: { certificate: 'Road test certificate', 'cdl-equivalent': 'CDL accepted as equivalent', 'other-equivalent': 'Certificate accepted as equivalent', '391.44-statement': 'Written statement under 391.44(d)' }[f.roadTest.kind] + ` (${f.roadTest.date}).`, citation: '49 CFR 391.51(b)(3), 391.31, 391.33' }
    : { item: 'Road test certificate or equivalent', state: 'missing', detail: 'No road test certificate or accepted equivalent.', citation: '49 CFR 391.51(b)(3), 391.31, 391.33' });

  const annual = (name: string, dates: string[] | undefined, cite: string) => {
    const last = latest(dates);
    const base = last ?? f.hireDate;
    const due = addMonths(base, 12);
    if (!last && employedMonths < 12) { push({ item: name, state: 'ok', detail: `First one due by ${due} (12 months after hire).`, nextDue: due, citation: cite }); return; }
    const state: ItemState = asOf > due ? 'overdue' : addDays(asOf, soon) >= due ? 'due-soon' : 'ok';
    push({ item: name, state, detail: `${last ? `Last done ${last}` : 'Never done'}; next due ${due}.`, nextDue: due, citation: cite });
  };
  annual('Annual MVR inquiry', f.annualMvr, '49 CFR 391.25(a), 391.51(b)(4)');
  annual('Annual review of driving record (note)', f.annualReview, '49 CFR 391.25(b)-(c), 391.51(b)(5)');

  if (!f.medicalCert) push({ item: 'Medical examiner\'s certificate', state: 'missing', detail: 'No medical certificate on file.', citation: '49 CFR 391.51(b)(6), 391.43, 391.45' });
  else {
    const e = f.medicalCert.expires;
    const maxEnd = addMonths(f.medicalCert.issued, 24);
    const state: ItemState = asOf > e ? 'expired' : addDays(asOf, soon) >= e ? 'due-soon' : 'ok';
    push({ item: 'Medical examiner\'s certificate', state, detail: `Issued ${f.medicalCert.issued}, expires ${e}.${e > maxEnd ? ' The expiration is more than 24 months after issue; check the date.' : ''}`, nextDue: e, citation: '49 CFR 391.51(b)(6), 391.43, 391.45' });
  }
  if (f.cdl) {
    push(f.cdlisMedicalMvr
      ? { item: 'CDLIS MVR showing medical certification status', state: 'ok', detail: `Obtained ${f.cdlisMedicalMvr}.`, citation: '49 CFR 391.51(b)(6)(ii)' }
      : { item: 'CDLIS MVR showing medical certification status', state: 'missing', detail: 'For CDL holders the carrier must get the CDLIS MVR with medical status from the current licensing state; the 15-day allowance for using a paper copy of a new certificate ended June 22, 2025.', citation: '49 CFR 391.51(b)(6)(ii)' });
  } else {
    push(f.nationalRegistryNote
      ? { item: 'National Registry verification note', state: 'ok', detail: `Verified ${f.nationalRegistryNote}.`, citation: '49 CFR 391.51(b)(8)(i), 391.23(m)(1)' }
      : { item: 'National Registry verification note', state: 'missing', detail: 'Note that the medical examiner was listed on the National Registry.', citation: '49 CFR 391.51(b)(8)(i), 391.23(m)(1)' });
  }
  if (f.medicalVariance?.needed) {
    const v = f.medicalVariance;
    push(!v.date ? { item: 'Medical variance (SPE certificate or exemption)', state: 'missing', detail: 'The driver needs a variance and none is on file.', citation: '49 CFR 391.51(b)(7), 391.49' }
      : { item: 'Medical variance (SPE certificate or exemption)', state: v.expires && asOf > v.expires ? 'expired' : 'ok', detail: `Dated ${v.date}${v.expires ? `, expires ${v.expires}` : ''}.`, nextDue: v.expires, citation: '49 CFR 391.51(b)(7), 391.49' });
  }

  if (f.cdl) {
    const pre = f.clearinghousePreEmployment;
    push(!pre ? { item: 'Clearinghouse pre-employment full query', state: 'missing', detail: 'Required before the driver performs any safety-sensitive function.', citation: '49 CFR 382.701(a)' }
      : { item: 'Clearinghouse pre-employment full query', state: pre > f.hireDate ? 'late' : 'ok', detail: pre > f.hireDate ? `Run ${pre}, after the hire date ${f.hireDate}; it must come before any safety-sensitive work.` : `Run ${pre}.`, citation: '49 CFR 382.701(a)' });
    annual('Clearinghouse annual query', f.clearinghouseAnnual, '49 CFR 382.701(b)');
  }

  // Not qualified to drive right now
  const blockingItems = new Set(['Medical examiner\'s certificate', 'Road test certificate or equivalent', 'Clearinghouse pre-employment full query', 'Medical variance (SPE certificate or exemption)']);
  const blocking = items.filter((i) => blockingItems.has(i.item) && (i.state === 'missing' || i.state === 'expired')).map((i) => `${i.item}: ${i.detail}`);

  const purgeable: DqResult['purgeable'] = [];
  const older = (name: string, dates?: string[]) => {
    for (const d of (dates ?? []).sort().slice(0, -1)) if (addMonths(d, 36) <= asOf) purgeable.push({ item: name, date: d, removableAfter: addMonths(d, 36) });
  };
  older('Annual MVR inquiry', f.annualMvr);
  older('Annual review note', f.annualReview);

  return {
    driver: f.driver, asOf, items, blocking,
    score: { ok: items.filter((i) => i.state === 'ok').length, total: items.length },
    retainUntil: f.terminatedOn ? addMonths(f.terminatedOn, 36) : undefined,
    purgeable,
  };
}

/** Check many drivers and list what is due in the next `days` days, soonest first. */
export function dueList(files: DriverFile[], asOf: string, days = 60) {
  const until = addDays(asOf, days);
  return files.flatMap((f) => checkDqFile(f, asOf).items.filter((i) => i.nextDue && i.nextDue <= until && i.state !== 'n/a').map((i) => ({ driver: f.driver, item: i.item, due: i.nextDue!, state: i.state })))
    .sort((a, b) => (a.due < b.due ? -1 : 1));
}
