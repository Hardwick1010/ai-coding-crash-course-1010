import { describe, it, expect } from "vitest";
import { formatMoney } from "./utils";

describe("formatMoney", () => {
  it("renders zero as $0.00, never Free", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("always shows cents", () => {
    expect(formatMoney(4900)).toBe("$49.00");
    expect(formatMoney(5)).toBe("$0.05");
  });

  it("groups thousands", () => {
    expect(formatMoney(123456789)).toBe("$1,234,567.89");
  });
});
