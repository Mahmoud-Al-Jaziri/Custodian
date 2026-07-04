// Skeleton placeholders shown while content loads. Each composed skeleton
// mirrors the layout of the content it stands in for, so the swap to real
// content doesn't shift the page around.

export function Skel({ w = "100%", h = 14, r = 8, className = "", style = {} }) {
  return (
    <div
      aria-hidden="true"
      className={`skel ${className}`}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

/** Mirrors LetterCard: label, a few lines of serif text, timestamp. */
export function LetterSkeleton() {
  return (
    <div className="letter-card border-amber-left mb-3 p-3">
      <Skel w={110} h={10} className="mb-3" />
      <Skel w="92%" className="mb-2" />
      <Skel w="100%" className="mb-2" />
      <Skel w="64%" className="mb-3" />
      <Skel w={130} h={9} />
    </div>
  );
}

/** Mirrors the Dashboard: header row, streak card, one thing, timer, CTA. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true">
      {/* Wordmark + day badge */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Skel w={92} h={16} />
        <Skel w={118} h={24} r={20} />
      </div>

      {/* Streak card: number row + month calendar */}
      <div className="score-ring-wrap p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <Skel w={88} h={30} className="mb-2" />
            <Skel w={70} h={9} />
          </div>
          <div className="d-flex flex-column align-items-end gap-2">
            <Skel w={48} h={9} />
            <Skel w={40} h={9} />
          </div>
        </div>
        <Skel h={230} r={18} />
      </div>

      {/* One thing */}
      <div className="p-3 mb-3">
        <Skel w={140} h={9} className="mb-3" />
        <Skel w="80%" />
      </div>

      {/* Pomodoro */}
      <div className="p-3 mb-3 d-flex flex-column align-items-center">
        <Skel w={70} h={9} className="mb-2" />
        <Skel w={120} h={38} className="mb-3" />
        <Skel w={210} h={38} r={12} />
      </div>

      {/* Primary CTA */}
      <Skel h={54} r={12} />
    </div>
  );
}
