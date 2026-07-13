import { describe, expect, it } from "vitest";

import { formatNational, stripTrunkZero } from "./PhoneInput";

describe("stripTrunkZero", () => {
  it("strips a leading trunk zero for non-Italian numbers (regression: QA-fixed trunk-zero bug)", () => {
    // NL mobile typed with the national trunk prefix: "0612345678".
    expect(stripTrunkZero("0612345678", "+31")).toBe("612345678");
  });

  it("strips multiple leading zeros", () => {
    expect(stripTrunkZero("00612345678", "+31")).toBe("612345678");
  });

  it("leaves Italian numbers untouched (the one documented exception)", () => {
    expect(stripTrunkZero("0612345678", "+39")).toBe("0612345678");
  });

  it("is a no-op when there's no leading zero", () => {
    expect(stripTrunkZero("612345678", "+31")).toBe("612345678");
  });

  it("does not strip zeros that aren't leading", () => {
    expect(stripTrunkZero("6102345678", "+31")).toBe("6102345678");
  });
});

describe("formatNational", () => {
  it("groups +1 numbers as (XXX) XXX-XXXX progressively", () => {
    expect(formatNational("555", "+1")).toBe("555");
    expect(formatNational("555123", "+1")).toBe("(555) 123");
    expect(formatNational("5551234", "+1")).toBe("(555) 123-4");
    expect(formatNational("5551234567", "+1")).toBe("(555) 123-4567");
  });

  it("space-groups non-+1 numbers in 3s", () => {
    expect(formatNational("612345678", "+31")).toBe("612 345 678");
  });

  it("handles an empty string without throwing", () => {
    expect(formatNational("", "+1")).toBe("");
    expect(formatNational("", "+31")).toBe("");
  });
});
