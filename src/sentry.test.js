// The breadcrumb scrubber is the one piece of the Sentry setup that carries a
// real privacy consequence, so it gets a test rather than a comment.
// /api/weather?lat=..&lon=.. is the user's precise location, and breadcrumbs
// ride along on every unrelated error report.

import { describe, it, expect } from "vitest";
import { scrubBreadcrumb } from "./sentry.js";

describe("scrubBreadcrumb", () => {
  it("strips the coordinates off a weather request", () => {
    const result = scrubBreadcrumb({
      category: "fetch",
      data: {
        url: "https://custodian-coral.vercel.app/api/weather?lat=3.049123997574968&lon=101.7707019383939",
      },
    });

    expect(result.data.url).toBe(
      "https://custodian-coral.vercel.app/api/weather"
    );
    expect(result.data.url).not.toContain("lat");
    expect(result.data.url).not.toContain("101.77");
  });

  it("strips query strings from any endpoint, not just weather", () => {
    // Allow-listing would mean a new route leaks until someone remembers to
    // add it here. The date in this one is itself personal information.
    const result = scrubBreadcrumb({
      data: { url: "/api/handoffs/today?today=2026-08-11" },
    });

    expect(result.data.url).toBe("/api/handoffs/today");
  });

  it("leaves a url with no query string alone", () => {
    const result = scrubBreadcrumb({ data: { url: "/api/handoffs" } });
    expect(result.data.url).toBe("/api/handoffs");
  });

  it("passes through breadcrumbs that have no url", () => {
    // Console and navigation breadcrumbs have no data.url at all; the scrubber
    // must not throw on them or it takes down error reporting entirely.
    expect(() => scrubBreadcrumb({ category: "console" })).not.toThrow();
    expect(() => scrubBreadcrumb({ category: "ui.click", data: {} })).not.toThrow();
    expect(() => scrubBreadcrumb(null)).not.toThrow();
  });

  it("returns the breadcrumb so Sentry still records it", () => {
    // Returning undefined would silently DROP the breadcrumb rather than
    // sanitize it, quietly gutting the context we want on real errors.
    const breadcrumb = { category: "fetch", data: { url: "/api/x?y=1" } };
    expect(scrubBreadcrumb(breadcrumb)).toBe(breadcrumb);
  });
});
