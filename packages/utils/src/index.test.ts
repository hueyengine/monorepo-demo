import { describe, expect, it } from "vitest";
import { classNames, formatDate, sleep } from "./index";

describe("formatDate", () => {
  it("formats a date in zh-CN by default", () => {
    const date = new Date("2026-04-26T00:00:00Z");
    const result = formatDate(date);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/04/);
  });

  it("respects the locale argument", () => {
    const date = new Date("2026-04-26T00:00:00Z");
    const result = formatDate(date, "en-US");
    expect(result).toMatch(/2026/);
  });
});

describe("classNames", () => {
  it("joins truthy values with spaces", () => {
    expect(classNames("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values", () => {
    expect(classNames("a", false, null, undefined, "b")).toBe("a b");
  });

  it("returns empty string when no truthy values", () => {
    expect(classNames(false, null, undefined)).toBe("");
  });
});

describe("sleep", () => {
  it("resolves after the given duration", async () => {
    const start = Date.now();
    await sleep(20);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(15);
  });
});
