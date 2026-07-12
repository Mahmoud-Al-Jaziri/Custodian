import { describe, it, expect } from "vitest";
import { launchRoute } from "./launchRoute.js";

describe("launchRoute", () => {
  it("opens Morning from 04:00 through 10:59", () => {
    expect(launchRoute(4)).toBe("/morning");
    expect(launchRoute(7)).toBe("/morning");
    expect(launchRoute(10)).toBe("/morning");
  });

  it("opens the Dashboard from 11:00 through 17:59", () => {
    expect(launchRoute(11)).toBe("/dashboard");
    expect(launchRoute(14)).toBe("/dashboard");
    expect(launchRoute(17)).toBe("/dashboard");
  });

  it("opens Evening from 18:00 onward", () => {
    expect(launchRoute(18)).toBe("/evening");
    expect(launchRoute(21)).toBe("/evening");
    expect(launchRoute(23)).toBe("/evening");
  });

  it("treats the small hours as still-tonight (late writers)", () => {
    expect(launchRoute(0)).toBe("/evening");
    expect(launchRoute(3)).toBe("/evening");
  });
});
