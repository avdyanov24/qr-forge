import { useEffect, useState } from "react";
import type { QrConfig } from "../lib/qr";
import {
  PREVIEW_DPI,
  renderTemplate,
  templateById,
  type LayoutConfig,
} from "../lib/templates";

export function TemplatePreview({
  config,
  layout,
  onRender,
}: {
  config: QrConfig;
  layout: LayoutConfig;
  onRender: (moduleCount: number | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const template = templateById(layout.template);
  const empty = config.data.trim() === "";

  useEffect(() => {
    if (empty) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let created: string | null = null;

    renderTemplate(config, layout, PREVIEW_DPI)
      .then((result) => {
        if (cancelled) return;
        created = URL.createObjectURL(result.blob);
        setUrl(created);
        setFailed(false);
        onRender(result.moduleCount);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [config, layout, empty, onRender]);

  return (
    <div
      className="flex w-full items-center justify-center"
      style={{ maxWidth: `min(100%, ${template.widthMm * 4}px)` }}
    >
      <div
        className="w-full"
        style={{ aspectRatio: `${template.widthMm} / ${template.heightMm}` }}
      >
        {url ? (
          <img
            src={url}
            alt={`${template.label} layout preview`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center border border-edge">
            <span className="label">{failed ? "Render failed" : "Awaiting input"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
