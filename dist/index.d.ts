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
    roadTest?: {
        date: string;
        kind: 'certificate' | 'cdl-equivalent' | 'other-equivalent' | '391.44-statement';
    };
    /** Each annual MVR inquiry date (391.25(a)). */
    annualMvr?: string[];
    /** Each annual review note date (391.25(b), (c)(2)). */
    annualReview?: string[];
    medicalCert?: {
        issued: string;
        expires: string;
    };
    /** CDL holders: date of the CDLIS MVR showing medical certification status (391.51(b)(6)(ii)). */
    cdlisMedicalMvr?: string;
    /** Non-CDL drivers: date of the National Registry verification note (391.23(m)(1), 391.51(b)(8)(i)). */
    nationalRegistryNote?: string;
    /** SPE certificate or medical exemption, if the driver needs one (391.49, Part 381). */
    medicalVariance?: {
        needed: boolean;
        date?: string;
        expires?: string;
    };
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
    score: {
        ok: number;
        total: number;
    };
    /** When the whole file may be destroyed (3 years after employment ends), if terminated. */
    retainUntil?: string;
    /** Older copies of recurring records that may be removed (3 years after execution, 391.51(d)). */
    purgeable: Array<{
        item: string;
        date: string;
        removableAfter: string;
    }>;
}
/** Check one driver's qualification file. `soonDays` sets when an expiring or recurring item counts as due soon (default 30). */
export declare function checkDqFile(f: DriverFile, asOf: string, opts?: {
    soonDays?: number;
}): DqResult;
/** Check many drivers and list what is due in the next `days` days, soonest first. */
export declare function dueList(files: DriverFile[], asOf: string, days?: number): {
    driver: string;
    item: string;
    due: string;
    state: ItemState;
}[];
