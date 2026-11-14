# X3 DQ File

**Check a driver qualification file against 49 CFR 391.51 and the deadlines behind it.** What is missing, late, expiring or overdue, when each item is next due, whether the driver is qualified to drive today, and what may be purged.

**[Try the DQ file checker →](https://x3allamerican.github.io/x3-dq-file/)**

Built and maintained by **[X3 Fleet Safety](https://x3fleetsafety.com)**.

## Install

```sh
npm install github:x3allamerican/x3-dq-file
```

## Use

```ts
import { checkDqFile, dueList } from '@x3/dq-file';

const r = checkDqFile({
  driver: 'EMP-1001', hireDate: '2024-03-04', cdl: true,
  application: '2024-02-20', preEmploymentMvr: '2024-02-21', safetyPerformanceHistory: '2024-04-10',
  roadTest: { date: '2024-02-22', kind: 'cdl-equivalent' },
  annualMvr: ['2025-02-28'], annualReview: ['2025-03-03'],
  medicalCert: { issued: '2025-05-01', expires: '2027-05-01' }, cdlisMedicalMvr: '2025-05-10',
  clearinghousePreEmployment: '2024-02-21', clearinghouseAnnual: ['2025-02-28'],
}, '2026-11-14');

r.items;    // [{ item, state: 'ok' | 'missing' | 'late' | 'due-soon' | 'overdue' | 'expired', detail, nextDue, citation }]
r.blocking; // what keeps the driver from driving today (medical card, road test, Clearinghouse query)
r.purgeable; r.retainUntil;

dueList(allFiles, '2026-11-14', 60); // everything due in the next 60 days across the fleet, soonest first
```

## Rules covered

| Item | Rule | Check |
|---|---|---|
| Application | 391.21, 391.51(b)(1) | On file |
| Pre-employment MVR, 3 years, each state | 391.23(a)(1) | Within 30 days of hire |
| Safety performance history, 3 years | 391.23(a)(2), (c) | Within 30 days of hire |
| Road test or equivalent | 391.31, 391.33, 391.51(b)(3) | On file |
| Annual MVR | 391.25(a) | Every 12 months |
| Annual review note | 391.25(b)-(c) | Every 12 months |
| Medical examiner's certificate | 391.43, 391.45, 391.51(b)(6) | Current; expiring soon; over 24 months |
| CDLIS MVR with medical status (CDL) | 391.51(b)(6)(ii) | On file (the paper-copy allowance ended June 22, 2025) |
| National Registry note (non-CDL) | 391.23(m)(1), 391.51(b)(8)(i) | On file |
| SPE certificate or medical exemption | 391.49, 391.51(b)(7) | When needed |
| Clearinghouse pre-employment full query (CDL) | 382.701(a) | Before any safety-sensitive work |
| Clearinghouse annual query (CDL) | 382.701(b) | Every 12 months |
| Retention and purge | 391.51(c)-(d) | 3 years after employment ends; older annual records after 3 years |

## Limits

Decision support, not legal advice. Interstate drivers under Part 391; check intrastate and exempt operations (Subpart G) separately. The checker trusts the dates you give it; it does not read the documents.

## Develop

```sh
npm install
npm test
npm run build
```

## License

MIT. Free for any use, including commercial.

---

**[X3 Fleet Safety](https://x3fleetsafety.com)** keeps every DQ file current automatically, with hours of service, drug and alcohol and CSA in the same place.
