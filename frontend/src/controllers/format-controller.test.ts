import { describe, expect, it } from "vitest";

import { fmt, statusMeta } from "./format-controller";

describe("fmt", () => {
  it("formats numeric values", () => {
    expect(fmt(3.14159, 2)).toBe("3.14");
  });

  it("returns N/A for non numeric values", () => {
    expect(fmt(undefined)).toBe("N/A");
    expect(fmt("x")).toBe("N/A");
  });
});

describe("statusMeta", () => {
  it("formats source and model", () => {
    expect(statusMeta({ source: "gemini", model: "2.5-pro" })).toBe("Source: gemini | 2.5-pro");
  });

  it("falls back cleanly", () => {
    expect(statusMeta()).toBe("Source: N/A");
  });
});
