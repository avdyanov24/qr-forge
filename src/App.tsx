import { useEffect, useMemo, useState } from "react";
import {
  analyzeRisk,
  CORNER_DOT_STYLES,
  CORNER_STYLES,
  DEFAULT_CONFIG,
  DOT_STYLES,
  ECC_LEVELS,
  exportCode,
  GRADIENT_TYPES,
  MARGIN_MAX,
  MARGIN_MIN,
  MARGIN_STEP,
  SHAPES,
  SIZE_MAX,
  SIZE_MIN,
  SIZE_STEP,
  type FileExtension,
  type GradientType,
  type QrConfig,
} from "./lib/qr";
import { ColorField, LogoField, Section, Segmented, Select, Slider } from "./components/Controls";
import { ExportActions } from "./components/ExportActions";
import { Preview } from "./components/Preview";
import { ScanRisk } from "./components/ScanRisk";

const DEBOUNCE_MS = 300;

export default function App() {
  const [config, setConfig] = useState<QrConfig>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState(DEFAULT_CONFIG.data);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<FileExtension | null>(null);

  // Live preview, debounced 300ms. Every other control applies immediately.
  useEffect(() => {
    const timer = setTimeout(() => {
      setConfig((current) => (current.data === draft ? current : { ...current, data: draft }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  function set<K extends keyof QrConfig>(key: K, value: QrConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  const findings = useMemo(() => analyzeRisk(config), [config]);
  const ready = config.data.trim() !== "";

  async function download(extension: FileExtension) {
    if (pending) return;
    setNotice(null);
    setPending(extension);
    try {
      // Yield so the pending state paints before the thread blocks. This is a
      // timeout rather than requestAnimationFrame, which never fires while the
      // tab is hidden and would strand the export mid-flight.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await exportCode(config, extension);
    } catch {
      setNotice("Export failed. Try a smaller size.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
      {/*
        Below lg the two regions stack and the page scrolls as one, with the
        preview first — it is the object, the rail only describes it. Above
        lg the rail is a fixed 280px column that scrolls on its own.
      */}
      <aside className="order-2 flex w-full shrink-0 flex-col border-t border-edge lg:order-1 lg:w-[280px] lg:overflow-y-auto lg:border-t-0 lg:border-r">
        <header className="px-6 pb-7 pt-8">
          <h1 className="text-[15px] leading-none tracking-[-0.02em] text-bone">QR Generator</h1>
          <p className="label mt-3">Client side only</p>
        </header>

        <Section title="Content">
          <textarea
            className="field resize-none"
            rows={3}
            spellCheck={false}
            placeholder="https://"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Text or URL"
          />
        </Section>

        <Section title="Colour">
          <ColorField
            label="Foreground"
            value={config.foreground}
            onChange={(value) => set("foreground", value)}
          />

          <Select
            label="Gradient"
            value={config.gradient?.type ?? "none"}
            options={GRADIENT_TYPES}
            onChange={(value) =>
              set(
                "gradient",
                value === "none"
                  ? null
                  : {
                      type: value as GradientType,
                      color: config.gradient?.color ?? "#C8A24A",
                      rotation: config.gradient?.rotation ?? 45,
                    },
              )
            }
          />

          {config.gradient && (
            <>
              <ColorField
                label="Gradient end"
                value={config.gradient.color}
                onChange={(value) =>
                  set("gradient", { ...config.gradient!, color: value })
                }
              />
              {config.gradient.type === "linear" && (
                <Slider
                  label="Angle"
                  value={config.gradient.rotation}
                  min={0}
                  max={360}
                  step={15}
                  display={`${config.gradient.rotation}°`}
                  onChange={(value) =>
                    set("gradient", { ...config.gradient!, rotation: value })
                  }
                />
              )}
            </>
          )}

          <ColorField
            label="Background"
            value={config.background}
            onChange={(value) => set("background", value)}
          />

          <Segmented
            label="Corner colour"
            value={config.cornerColor ? "Custom" : "Match"}
            options={["Match", "Custom"]}
            onChange={(value) =>
              set("cornerColor", value === "Custom" ? config.foreground : null)
            }
          />
          {config.cornerColor && (
            <ColorField
              label="Corners"
              value={config.cornerColor}
              onChange={(value) => set("cornerColor", value)}
            />
          )}
        </Section>

        <Section title="Form">
          <Select
            label="Dot style"
            value={config.dotStyle}
            options={DOT_STYLES}
            onChange={(value) => set("dotStyle", value)}
          />
          <Select
            label="Corner style"
            value={config.cornerStyle}
            options={CORNER_STYLES}
            onChange={(value) => set("cornerStyle", value)}
          />
          <Select
            label="Corner centre"
            value={config.cornerDotStyle}
            options={CORNER_DOT_STYLES}
            onChange={(value) => set("cornerDotStyle", value)}
          />
          <Select
            label="Frame"
            value={config.shape}
            options={SHAPES}
            onChange={(value) => set("shape", value)}
          />
          <Slider
            label="Quiet zone"
            value={config.margin}
            min={MARGIN_MIN}
            max={MARGIN_MAX}
            step={MARGIN_STEP}
            display={`${Math.round(config.margin * 100)}%`}
            onChange={(value) => set("margin", value)}
          />
        </Section>

        <Section title="Encoding">
          <Segmented
            label="Error correction"
            value={config.ecc}
            options={ECC_LEVELS}
            onChange={(value) => set("ecc", value)}
          />
          <LogoField
            logo={config.logo}
            onChange={(logo) => set("logo", logo)}
            onError={setNotice}
          />
          {config.logo && (
            <Slider
              label="Logo size"
              value={config.logoScale}
              min={0.1}
              max={1}
              step={0.05}
              display={`${Math.round(config.logoScale * 100)}% of ECC`}
              onChange={(value) => set("logoScale", value)}
            />
          )}
        </Section>

        <Section title="Output">
          <Slider
            label="Size"
            value={config.size}
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={SIZE_STEP}
            display={`${config.size} px`}
            onChange={(value) => set("size", value)}
          />
          {/* Below lg these live in the docked bar instead. */}
          <div className="mt-1 hidden lg:block">
            <ExportActions
              ready={ready}
              pending={pending}
              notice={notice}
              onExport={download}
            />
          </div>
        </Section>

        <div className="grow" />
      </aside>

      {/* Preview field. */}
      <main className="grid-field order-1 flex grow flex-col lg:order-2 lg:overflow-y-auto">
        <div className="flex grow items-center justify-center p-5 sm:p-10 lg:p-16">
          <Preview config={config} />
        </div>

        {findings.length > 0 && (
          <div className="shrink-0 px-5 pb-8 sm:px-10 lg:px-16 lg:pb-10">
            <div className="mx-auto max-w-[540px]">
              <ScanRisk findings={findings} />
            </div>
          </div>
        )}

        <footer className="shrink-0 border-t border-edge px-6 py-4">
          <p className="font-mono text-[11px] leading-none text-ash tabular-nums">
            {config.size} × {config.size} · ECC {config.ecc} ·{" "}
            {new TextEncoder().encode(config.data).length} bytes
          </p>
        </footer>
      </main>

      {/*
        Stacked, the rail runs long enough to bury the export controls, so
        below lg they dock to the bottom of the viewport instead.
      */}
      <div className="sticky bottom-0 order-3 border-t border-edge bg-void px-5 py-4 lg:hidden">
        <ExportActions ready={ready} pending={pending} notice={notice} onExport={download} />
      </div>
    </div>
  );
}
