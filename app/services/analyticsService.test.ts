import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { getInstructorRevenue } from "./analyticsService";
import { createTeamPurchase } from "./purchaseService";
import { redeemCoupon } from "./couponService";

function insertCourse(slug: string, instructorId: number, status: schema.CourseStatus) {
  return testDb
    .insert(schema.courses)
    .values({
      title: slug,
      slug,
      description: "A course",
      salesCopy: "Sales copy",
      instructorId,
      categoryId: base.category.id,
      status,
    })
    .returning()
    .get();
}

function insertPurchase(courseId: number, amountPaid: number, createdAt?: string) {
  return testDb
    .insert(schema.purchases)
    .values({
      userId: base.user.id,
      courseId,
      amountPaid,
      country: "US",
      ...(createdAt ? { createdAt } : {}),
    })
    .returning()
    .get();
}

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getInstructorRevenue", () => {
    it("returns gross, fee, net and purchase count for the instructor's purchases", () => {
      insertPurchase(base.course.id, 5000);
      insertPurchase(base.course.id, 10000);

      expect(getInstructorRevenue(base.instructor.id)).toEqual({
        grossRevenue: 15000,
        platformFee: 3000,
        netEarnings: 12000,
        purchaseCount: 2,
      });
    });

    it("rounds the fee to the nearest cent and keeps fee + net equal to gross", () => {
      insertPurchase(base.course.id, 4999);

      expect(getInstructorRevenue(base.instructor.id)).toEqual({
        grossRevenue: 4999,
        platformFee: 1000,
        netEarnings: 3999,
        purchaseCount: 1,
      });
    });

    it("counts the amount actually paid on a PPP-discounted purchase", () => {
      testDb
        .insert(schema.purchases)
        .values({ userId: base.user.id, courseId: base.course.id, amountPaid: 2500, country: "IN" })
        .run();

      const revenue = getInstructorRevenue(base.instructor.id);
      expect(revenue.grossRevenue).toBe(2500);
      expect(revenue.purchaseCount).toBe(1);
    });

    it("counts a team purchase once at full amount and adds nothing for a coupon redemption", () => {
      const { coupons } = createTeamPurchase(base.user.id, base.course.id, 20000, "US", 5);
      const student = testDb
        .insert(schema.users)
        .values({ name: "Coupon Student", email: "coupon@example.com", role: schema.UserRole.Student })
        .returning()
        .get();
      const result = redeemCoupon(coupons[0].code, student.id, "US");
      expect(result.ok).toBe(true);

      expect(getInstructorRevenue(base.instructor.id)).toEqual({
        grossRevenue: 20000,
        platformFee: 4000,
        netEarnings: 16000,
        purchaseCount: 1,
      });
    });

    it("excludes other instructors' purchases", () => {
      const other = testDb
        .insert(schema.users)
        .values({ name: "Other Instructor", email: "other@example.com", role: schema.UserRole.Instructor })
        .returning()
        .get();
      const otherCourse = insertCourse("other-course", other.id, schema.CourseStatus.Published);
      insertPurchase(base.course.id, 5000);
      insertPurchase(otherCourse.id, 9900);

      const revenue = getInstructorRevenue(base.instructor.id);
      expect(revenue.grossRevenue).toBe(5000);
      expect(revenue.purchaseCount).toBe(1);
    });

    it("includes purchases of draft and archived courses", () => {
      const draft = insertCourse("draft-course", base.instructor.id, schema.CourseStatus.Draft);
      const archived = insertCourse("archived-course", base.instructor.id, schema.CourseStatus.Archived);
      insertPurchase(base.course.id, 1000);
      insertPurchase(draft.id, 2000);
      insertPurchase(archived.id, 3000);

      const revenue = getInstructorRevenue(base.instructor.id);
      expect(revenue.grossRevenue).toBe(6000);
      expect(revenue.purchaseCount).toBe(3);
    });

    it("includes a purchase made exactly at the range start", () => {
      insertPurchase(base.course.id, 4000, "2026-10-16T12:00:00.000Z");

      const revenue = getInstructorRevenue(base.instructor.id, new Date("2026-10-16T12:00:00.000Z"));
      expect(revenue.grossRevenue).toBe(4000);
      expect(revenue.purchaseCount).toBe(1);
    });

    it("excludes a purchase made just before the range start", () => {
      insertPurchase(base.course.id, 1000, "2026-10-16T11:59:59.999Z");
      insertPurchase(base.course.id, 4000, "2026-10-20T09:30:00.000Z");

      expect(getInstructorRevenue(base.instructor.id, new Date("2026-10-16T12:00:00.000Z"))).toEqual({
        grossRevenue: 4000,
        platformFee: 800,
        netEarnings: 3200,
        purchaseCount: 1,
      });
    });

    it("returns zeros when no purchases fall in the range", () => {
      insertPurchase(base.course.id, 5000, "2026-01-01T00:00:00.000Z");

      expect(getInstructorRevenue(base.instructor.id, new Date("2026-10-16T12:00:00.000Z"))).toEqual({
        grossRevenue: 0,
        platformFee: 0,
        netEarnings: 0,
        purchaseCount: 0,
      });
    });

    it("returns every purchase, however old, when no start is given", () => {
      insertPurchase(base.course.id, 1000, "2019-01-01T00:00:00.000Z");
      insertPurchase(base.course.id, 2000, "2024-06-15T12:00:00.000Z");
      insertPurchase(base.course.id, 3000);

      const revenue = getInstructorRevenue(base.instructor.id);
      expect(revenue.grossRevenue).toBe(6000);
      expect(revenue.purchaseCount).toBe(3);
    });

    it("returns zeros when the instructor has no purchases", () => {
      expect(getInstructorRevenue(base.instructor.id)).toEqual({
        grossRevenue: 0,
        platformFee: 0,
        netEarnings: 0,
        purchaseCount: 0,
      });
    });
  });
});
