// Pins the privacy guarantee in sentry.js.
//
// Breadcrumbs ride along on every error report, and fetch breadcrumbs carry the
// full request URL. /api/weather?lat=..&lon=.. is the user's precise physical
// location, so a regression here would quietly ship people's home coordinates
// to a third party attached to unrelated crash reports. That's the kind of bug
// nobody notices, which is exactly why it's worth a test.

import { describe, it, expect } from "vitest";
import { scrubBreadcrumb } from "./sentry.js";

const crumb = (url) => ({ category: "fetch", data: { url } });

describe("scrubBreadcrumb", () => {
  it("strips coordinates from the weather request", () => {
    const result = scrubBreadcrumb(
      crumb(
        "https://custodian-coral.vercel.app/api/weather?lat=3.049123997574968&lon=101.7707019383939"
      )
    );

    expect(result.data.url).toBe(
      "https://custodian-coral.vercel.app/api/weather"
    );
    expect(result.data.url).not.toContain("3.049");
    expect(result.data.url).not.toContain("101.77");
  });

  it("strips query strings from every endpoint, not just weather", () => {
    // Allow-listing known-safe routes would mean a new endpoint leaks by
    // default. The rule is "strip everything", so assert that broadly.
    for (const [url, expected] of [
      ["/api/handoffs?fields=summary", "/api/handoffs"],
      ["/api/handoffs/today?today=2026-08-11", "/api/handoffs/today"],
      ["/api/handoffs?limit=7", "/api/handoffs"],
      ["https://example.com/x?a=1&b=2&c=3", "https://example.com/x"],
    ]) {
      expect(scrubBreadcrumb(crumb(url)).data.url).toBe(expected);
    }
  });

  it("leaves URLs without a query string untouched", () => {
    expect(scrubBreadcrumb(crumb("/api/handoffs/latest")).data.url).toBe(
      "/api/handoffs/latest"
    );
  });

  it("keeps a Firebase Storage path but drops its access token", () => {
    // Download URLs carry ?alt=media&token=... — a bearer credential for the
    // object. It should never reach an error report either.
    const result = scrubBreadcrumb(
      crumb(
        "https://firebasestorage.googleapis.com/v0/b/x/o/handoffs%2Fuid%2F2026-08-11.webp?alt=media&token=secret-token"
      )
    );

    expect(result.data.url).not.toContain("token");
    expect(result.data.url).toContain("2026-08-11.webp");
  });

  it("passes through breadcrumbs it can't scrub instead of throwing", () => {
    // beforeBreadcrumb runs inside the SDK on every breadcrumb. Throwing here
    // would break error reporting itself, so every odd shape must survive.
    expect(scrubBreadcrumb(undefined)).toBeUndefined();
    expect(scrubBreadcrumb(null)).toBeNull();
    expect(scrubBreadcrumb({})).toEqual({});
    expect(scrubBreadcrumb({ data: {} })).toEqual({ data: {} });
    expect(scrubBreadcrumb({ category: "ui.click" })).toEqual({
      category: "ui.click",
    });
  });

  it("returns the breadcrumb, since returning nothing drops it", () => {
    // Sentry treats a null return as "discard this breadcrumb". Returning
    // undefined by accident would silently delete the breadcrumb trail.
    const input = crumb("/api/handoffs?limit=7");
    expect(scrubBreadcrumb(input)).toBe(input);
  });
});
