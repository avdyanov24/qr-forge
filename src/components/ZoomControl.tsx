/** Fit is 1. Everything else is a multiple of whatever fits the field. */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4];
export const ZOOM_FIT = 1;

export function ZoomControl({
  zoom,
  onChange,
}: {
  zoom: number;
  onChange: (zoom: number) => void;
}) {
  const index = ZOOM_STEPS.indexOf(zoom);
  const atMin = index <= 0;
  const atMax = index >= ZOOM_STEPS.length - 1;

  const step = (direction: -1 | 1) => {
    const next = ZOOM_STEPS[index + direction];
    if (next) onChange(next);
  };

  return (
    <div className="flex items-center border border-edge">
      <button
        type="button"
        className="h-[26px] w-[28px] cursor-pointer font-mono text-[13px] leading-none text-ash hover:text-bone disabled:cursor-not-allowed disabled:text-edge"
        onClick={() => step(-1)}
        disabled={atMin}
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        className="h-[26px] min-w-[52px] border-x border-edge px-2 font-mono text-[11px] leading-none text-bone tabular-nums hover:border-ash"
        onClick={() => onChange(ZOOM_FIT)}
        aria-label="Reset zoom to fit"
        title="Reset to fit"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className="h-[26px] w-[28px] cursor-pointer font-mono text-[13px] leading-none text-ash hover:text-bone disabled:cursor-not-allowed disabled:text-edge"
        onClick={() => step(1)}
        disabled={atMax}
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
}
