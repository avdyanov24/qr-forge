import { summarise, type StressReport } from "../lib/stress";

export function StressTest({
  report,
  running,
  supported,
  disabled,
  onRun,
}: {
  report: StressReport | null;
  running: boolean;
  supported: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className="btn"
        disabled={disabled || running || !supported}
        onClick={onRun}
      >
        {running ? "Testing" : "Run stress test"}
      </button>

      {!supported && (
        <p className="text-[12px] leading-[1.6] text-ash">
          This browser has no barcode reader built in, so the test cannot run here. Chrome and Edge
          have one.
        </p>
      )}

      {report?.supported && (
        <div className="flex flex-col gap-px border border-edge">
          <div className="panel px-4 py-4">
            <p className="font-mono text-[11px] leading-none text-bone tabular-nums">
              {report.passed} of {report.total} conditions
            </p>
            <p className="mt-2.5 text-[12px] leading-[1.6] text-ash">{summarise(report)}</p>
          </div>

          {report.outcomes.map((outcome) => (
            <div key={outcome.id} className="panel px-4 py-3">
              <div className="flex items-center gap-2.5">
                {/*
                  Failures are bone, passes are ash — severity reads as
                  brightness here as it does in the risk panel, so no second
                  accent colour is introduced.
                */}
                <span
                  aria-hidden
                  className={`h-[7px] w-[7px] shrink-0 ${outcome.decoded ? "bg-ash" : "bg-bone"}`}
                />
                <span className={`label ${outcome.decoded ? "" : "!text-bone"}`}>
                  {outcome.label}
                </span>
                <span className="ml-auto font-mono text-[11px] leading-none text-ash">
                  {outcome.decoded ? "read" : "failed"}
                </span>
              </div>
              {!outcome.decoded && (
                <>
                  <p className="mt-2 text-[12px] leading-[1.6] text-ash">{outcome.detail}</p>
                  {/*
                    Naming the failure without naming the fix leaves someone
                    stuck, so the actions are listed in the order most likely
                    to help.
                  */}
                  <p className="label mt-3 mb-2">To fix</p>
                  <ul className="flex flex-col gap-1.5">
                    {outcome.remedy.map((step) => (
                      <li key={step} className="flex gap-2 text-[12px] leading-[1.6] text-ash">
                        <span aria-hidden className="text-bone">
                          ·
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
