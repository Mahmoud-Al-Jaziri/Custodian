import * as Sentry from "@sentry/react";

// Error reporting. Guarded on the DSN so a fresh clone, CI, or a preview build
// without secrets simply runs without it — same pattern as App Check in
// firebase.js. Sentry's own calls are no-ops until init() runs, so nothing
// downstream needs to know whether reporting is on.
//
// PRIVACY. Custodian stores people's private reflections and photos of their
// life, so error reporting must not become a side channel for any of it:
//
//   - sendDefaultPii stays off, so no IP addresses or user identifiers.
//   - No tracing and no Session Replay. Replay in particular would record a
//     user typing tonight's note. Neither is a default integration; the point
//     here is that we never add them.
//   - Query strings are stripped from breadcrumb URLs. This one is not
//     theoretical: /api/weather?lat=..&lon=.. is the user's precise location,
//     and it would otherwise ride along on every unrelated error report.
//
// Note bodies travel in POST payloads, which the SDK does not capture.
// Exported for tests. Strips every query string rather than allow-listing
// known-safe endpoints, so a route added later can't start leaking by default.
export function scrubBreadcrumb(breadcrumb) {
  if (breadcrumb?.data?.url) {
    breadcrumb.data.url = String(breadcrumb.data.url).split("?")[0];
  }
  return breadcrumb;
}

export function initErrorReporting() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    // Errors only. Left at 0 rather than omitted so that turning tracing on is
    // a deliberate edit and not an accident.
    tracesSampleRate: 0,

    // `integrations` is deliberately not passed. Overriding it replaces the
    // defaults, which include the global window.onerror and unhandledrejection
    // handlers — i.e. passing an empty array here would silently disable most
    // of the error capture this file exists to provide.

    // fetch/xhr breadcrumbs carry the full request URL — see scrubBreadcrumb.
    beforeBreadcrumb: scrubBreadcrumb,
  });

  return true;
}
