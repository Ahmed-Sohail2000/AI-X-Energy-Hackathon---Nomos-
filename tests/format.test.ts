import { describe, expect, it } from "vitest";
import { isPracticeNumber, readDigitsDe } from "../src/utils/format.js";

describe("format utilities", () => {
  it("formats MaLo digits for German readback", () => {
    expect(readDigitsDe("50312478901")).toBe(
      "fuenf, null, drei, eins, zwei, vier, sieben, acht, neun, null, eins"
    );
  });

  it("formats mixed reference numbers character by character", () => {
    expect(readDigitsDe("KL202644817")).toBe("K, L, zwei, null, zwei, sechs, vier, vier, acht, eins, sieben");
  });

  it("allows only the configured practice number", () => {
    expect(isPracticeNumber("+49 30 123", "+4930123")).toBe(true);
    expect(isPracticeNumber("+49 30 999", "+4930123")).toBe(false);
  });
});
