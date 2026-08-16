import { useEffect, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { buildOptions, DEFAULT_CONFIG } from "../lib/qr";
import { PRESET_SAMPLE, PRESETS, type Preset } from "../lib/presets";

const THUMB_SIZE = 120;

/**
 * Thumbnails are rendered once from a fixed short payload rather than from the
 * user's text. They are meant to show the style, and re-rendering six codes on
 * every keystroke to show the same six styles would be pure waste.
 */
function useThumbnails() {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    (async () => {
      const rendered = await Promise.all(
        PRESETS.map(async (preset) => {
          try {
            const instance = new QRCodeStyling(
              buildOptions(
                { ...DEFAULT_CONFIG, ...preset.code, data: PRESET_SAMPLE, logo: null },
                THUMB_SIZE,
              ),
            );
            const blob = (await instance.getRawData("svg")) as Blob | null;
            return blob ? ([preset.id, URL.createObjectURL(blob)] as const) : null;
          } catch {
            // A thumbnail that will not render is not worth failing the panel for.
            return null;
          }
        }),
      );

      const next: Record<string, string> = {};
      for (const entry of rendered) {
        if (!entry) continue;
        created.push(entry[1]);
        next[entry[0]] = entry[1];
      }

      if (cancelled) {
        created.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setUrls(next);
    })();

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  return urls;
}

export function PresetGrid({
  activeId,
  onApply,
}: {
  activeId: string | null;
  onApply: (preset: Preset) => void;
}) {
  const thumbnails = useThumbnails();
  const active = PRESETS.find((preset) => preset.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((preset) => {
          const selected = preset.id === activeId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApply(preset)}
              aria-pressed={selected}
              className={[
                "flex cursor-pointer flex-col items-stretch gap-2 rounded-[2px] border p-2",
                selected ? "border-ash" : "border-edge hover:border-ash",
              ].join(" ")}
            >
              <span className="flex aspect-square items-center justify-center bg-panel">
                {thumbnails[preset.id] ? (
                  <img
                    src={thumbnails[preset.id]}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : null}
              </span>
              <span
                className={`font-mono text-[11px] leading-none ${selected ? "text-bone" : "text-ash"}`}
              >
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[12px] leading-[1.6] text-ash">
        {active
          ? active.note
          : "Each one sets the code and the piece together. Your text, logo and template are left alone."}
      </p>
    </div>
  );
}
