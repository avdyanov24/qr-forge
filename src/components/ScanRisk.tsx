import type { RiskFinding } from "../lib/qr";

/**
 * Annunciator panel. No accent colour here — the accent marks focus and the
 * primary action only. Severity reads as brightness: bone for critical, ash
 * for marginal.
 */
export function ScanRisk({ findings }: { findings: RiskFinding[] }) {
  if (findings.length === 0) return null;

  return (
    <div className="flex flex-col gap-px border border-edge">
      {findings.map((finding) => {
        const critical = finding.level === "critical";
        return (
          <div key={finding.title} className="panel px-4 py-4">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span
                aria-hidden
                className={`h-[7px] w-[7px] shrink-0 ${critical ? "bg-bone" : "bg-ash"}`}
              />
              <span className={`label ${critical ? "!text-bone" : ""}`}>{finding.title}</span>
            </div>
            <p className="text-[12px] leading-[1.6] text-ash">{finding.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
