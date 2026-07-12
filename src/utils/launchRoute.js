// Where the app should open, based on the clock. The app has three
// "moments" — read (morning), do (day), write (evening) — and launch should
// land on the one that matches now instead of a generic dashboard.
//
// Evening deliberately runs past midnight: a 1am writer is still "tonight",
// the same convention the data layer uses for late-night handoffs.
export function launchRoute(hour = new Date().getHours()) {
  if (hour >= 4 && hour < 11) return "/morning";
  if (hour >= 11 && hour < 18) return "/dashboard";
  return "/evening"; // 18:00 – 03:59
}
