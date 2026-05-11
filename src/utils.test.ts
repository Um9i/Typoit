import { describe, it, expect } from "vitest";
import { fmtMs } from "./utils";

describe("fmtMs", () => {
  it("formats zero as 00:00:000", () => {
    expect(fmtMs(0)).toBe("00:00:000");
  });

  it("pads sub-second milliseconds", () => {
    expect(fmtMs(7)).toBe("00:00:007");
    expect(fmtMs(42)).toBe("00:00:042");
    expect(fmtMs(999)).toBe("00:00:999");
  });

  it("rolls over to seconds", () => {
    expect(fmtMs(1000)).toBe("00:01:000");
    expect(fmtMs(1234)).toBe("00:01:234");
    expect(fmtMs(59999)).toBe("00:59:999");
  });

  it("rolls over to minutes", () => {
    expect(fmtMs(60000)).toBe("01:00:000");
    expect(fmtMs(125_456)).toBe("02:05:456");
  });

  it("pads minutes to two digits but does not cap", () => {
    expect(fmtMs(10 * 60_000)).toBe("10:00:000");
    expect(fmtMs(123 * 60_000)).toBe("123:00:000");
  });
});
