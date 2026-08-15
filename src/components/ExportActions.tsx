import { EXPORT_FORMATS, type FileExtension } from "../lib/qr";

const [primary, ...secondary] = EXPORT_FORMATS;

export function ExportActions({
  ready,
  pending,
  notice,
  onExport,
}: {
  ready: boolean;
  pending: FileExtension | null;
  notice: string | null;
  onExport: (extension: FileExtension) => void;
}) {
  // Rasterising at 2048px takes seconds and blocks the thread, so the whole
  // group locks until it settles rather than queuing a second render.
  const busy = pending !== null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={!ready || busy}
        onClick={() => onExport(primary.value)}
      >
        {pending === primary.value ? "Rendering" : primary.label}
      </button>

      <div className="flex gap-2">
        {secondary.map((format) => (
          <button
            key={format.value}
            type="button"
            className="btn"
            disabled={!ready || busy}
            onClick={() => onExport(format.value)}
          >
            {pending === format.value ? "···" : format.label}
          </button>
        ))}
      </div>

      {notice && <p className="font-mono text-[11px] leading-[1.5] text-bone">{notice}</p>}
    </div>
  );
}
