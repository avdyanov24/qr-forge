import { useEffect, useRef, useState } from "react";
import { describeEncodeError, type QrConfig } from "../lib/qr";
import { PREVIEW_DPI, renderTemplate, templateById, type LayoutConfig } from "../lib/templates";

export function TemplatePreview({
  config,
  layout,
  onRender,
  onEncodeError,
}: {
  config: QrConfig;
  layout: LayoutConfig;
  onRender: (moduleCount: number | null) => void;
  onEncodeError: (message: string | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Held so the displayed object URL is only released once its replacement is
  // on screen. Revoking on cleanup pulls it out from under the <img> that is
  // still showing it, which survives only because the frame is already decoded.
  const shown = useRef<string | null>(null);
  const template = templateById(layout.template);
  const empty = config.data.trim() === "";

  useEffect(
    () => () => {
      if (shown.current) URL.revokeObjectURL(shown.current);
    },
    [],
  );

  useEffect(() => {
    if (empty) {
      setUrl(null);
      setError(null);
      onEncodeError(null);
      return;
    }

    let cancelled = false;

    renderTemplate(config, layout, PREVIEW_DPI)
      .then((result) => {
        const created = URL.createObjectURL(result.blob);
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }
        const previous = shown.current;
        shown.current = created;
        setUrl(created);
        setError(null);
        onEncodeError(null);
        onRender(result.moduleCount);
        if (previous) URL.revokeObjectURL(previous);
      })
      .catch((thrown) => {
        if (cancelled) return;
        const message = describeEncodeError(thrown);
        setUrl(null);
        setError(message);
        onEncodeError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [config, layout, empty, onRender, onEncodeError]);

  return (
    <div className="w-full" style={{ aspectRatio: `${template.widthMm} / ${template.heightMm}` }}>
      {url ? (
        <img
          src={url}
          alt={`${template.label} layout preview`}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-edge p-6">
          {error ? (
            <p className="max-w-[320px] text-center text-[12px] leading-[1.6] text-ash">{error}</p>
          ) : (
            <span className="label">Awaiting input</span>
          )}
        </div>
      )}
    </div>
  );
}
