import { and, count, eq, gte, sum } from "drizzle-orm";
import { db } from "~/db";
import { courses, purchases } from "~/db/schema";

// ─── Analytics Service ───
// Instructor revenue figures. Revenue is read from purchase rows only: amountPaid
// already reflects PPP discounts, a team purchase is one row at its full amount,
// and coupon redemptions create no purchase row. All course statuses count.
// Uses positional parameters (project convention).

/** The percent Cadence keeps, as shown in the "Platform fee (20%)" card label. */
export const PLATFORM_FEE_PERCENT = 20;
export const PLATFORM_FEE_RATE = PLATFORM_FEE_PERCENT / 100;

export type InstructorRevenue = {
  grossRevenue: number;
  platformFee: number;
  netEarnings: number;
  purchaseCount: number;
};

/**
 * Revenue for every course the instructor owns, from purchases made on or after
 * `since` (inclusive). Omit `since` for all time. Amounts are in cents; the fee is
 * rounded to the nearest cent and net = gross − fee, so the three always sum.
 */
export function getInstructorRevenue(
  instructorId: number,
  since?: Date
): InstructorRevenue {
  const row = db
    .select({ gross: sum(purchases.amountPaid), purchaseCount: count() })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        since ? gte(purchases.createdAt, since.toISOString()) : undefined
      )
    )
    .get();

  const grossRevenue = Number(row?.gross ?? 0);
  const platformFee = Math.round(grossRevenue * PLATFORM_FEE_RATE);

  return {
    grossRevenue,
    platformFee,
    netEarnings: grossRevenue - platformFee,
    purchaseCount: row?.purchaseCount ?? 0,
  };
}
