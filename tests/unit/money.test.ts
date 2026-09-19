import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  fromMinorUnits,
  splitByPercentage,
  splitByShares,
  splitEqual,
  subtractMoney,
  toMinorUnits,
  toMoney,
  validateExactSplit,
} from "@/lib/money";

describe("toMoney / rounding", () => {
  it("handles zero", () => {
    expect(toMoney(0).toString()).toBe("0");
    expect(toMoney("0.00").toString()).toBe("0");
  });

  it("handles the smallest unit (1 paisa)", () => {
    expect(toMoney("0.01").toString()).toBe("0.01");
  });

  it("rounds half-up to 2 decimal places", () => {
    expect(toMoney("10.005").toString()).toBe("10.01");
    expect(toMoney("10.004").toString()).toBe("10");
  });

  it("handles large amounts without precision loss", () => {
    expect(toMoney("9999999.99").toString()).toBe("9999999.99");
  });
});

describe("toMinorUnits / fromMinorUnits", () => {
  it("round-trips exactly", () => {
    expect(toMinorUnits("100.50")).toBe(10050);
    expect(fromMinorUnits(10050).toString()).toBe("100.5");
  });

  it("handles zero and one paisa", () => {
    expect(toMinorUnits("0")).toBe(0);
    expect(toMinorUnits("0.01")).toBe(1);
  });
});

describe("addMoney / subtractMoney", () => {
  it("adds a list of amounts precisely (no float drift)", () => {
    // 0.1 + 0.2 famously != 0.3 in IEEE754 float math.
    expect(addMoney("0.10", "0.20").toString()).toBe("0.3");
  });

  it("subtracts and can go negative", () => {
    expect(subtractMoney("10", "15").toString()).toBe("-5");
  });
});

describe("formatMoney", () => {
  it("formats INR with the currency symbol", () => {
    expect(formatMoney("1234.5", "INR")).toContain("1,234.50");
  });
});

describe("splitEqual", () => {
  it("splits evenly when it divides cleanly", () => {
    const result = splitEqual("100", 4).map((d) => d.toString());
    expect(result).toEqual(["25", "25", "25", "25"]);
  });

  it("distributes the leftover paisa deterministically when it doesn't divide evenly", () => {
    const result = splitEqual("100", 3).map((d) => d.toString());
    expect(result).toEqual(["33.34", "33.33", "33.33"]);
    // Sum must equal the original total exactly.
    expect(addMoney(...result).toString()).toBe("100");
  });

  it("handles a single recipient (100% to them)", () => {
    expect(splitEqual("50", 1).map((d) => d.toString())).toEqual(["50"]);
  });

  it("handles the smallest possible amount split many ways", () => {
    const result = splitEqual("0.01", 3).map((d) => d.toString());
    expect(result).toEqual(["0.01", "0", "0"]);
    expect(addMoney(...result).toString()).toBe("0.01");
  });

  it("throws for a non-positive count", () => {
    expect(() => splitEqual("100", 0)).toThrow();
  });
});

describe("splitByPercentage", () => {
  it("splits proportionally when percentages divide cleanly", () => {
    const result = splitByPercentage("1000", [50, 30, 20]).map((d) => d.toString());
    expect(result).toEqual(["500", "300", "200"]);
  });

  it("distributes rounding remainder to the largest shares deterministically", () => {
    // A three-way 33.33/33.33/33.34 split of 100 in paise doesn't divide evenly.
    const result = splitByPercentage("100", [33.33, 33.33, 33.34]).map((d) => d.toString());
    expect(addMoney(...result).toString()).toBe("100");
  });

  it("rejects percentages that don't sum to 100", () => {
    expect(() => splitByPercentage("100", [50, 30])).toThrow();
  });
});

describe("splitByShares", () => {
  it("splits proportionally to share units", () => {
    const result = splitByShares("100", [2, 1, 1]).map((d) => d.toString());
    expect(result).toEqual(["50", "25", "25"]);
    expect(addMoney(...result).toString()).toBe("100");
  });

  it("handles an uneven ratio that produces a rounding remainder", () => {
    const result = splitByShares("100", [1, 1, 1]).map((d) => d.toString());
    expect(addMoney(...result).toString()).toBe("100");
  });

  it("rejects a non-positive share", () => {
    expect(() => splitByShares("100", [1, 0])).toThrow();
  });
});

describe("validateExactSplit", () => {
  it("accepts amounts that sum exactly to the total", () => {
    expect(validateExactSplit("100", ["50", "30", "20"])).toBe(true);
  });

  it("rejects amounts that don't sum to the total", () => {
    expect(validateExactSplit("100", ["50", "30"])).toBe(false);
  });

  it("is exact for tricky decimal sums (no float drift)", () => {
    expect(validateExactSplit("0.30", ["0.10", "0.20"])).toBe(true);
  });
});
