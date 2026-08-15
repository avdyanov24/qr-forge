import { useEffect, useMemo, useState } from "react";
import {
  analyzeRisk,
  CORNER_STYLES,
  DEFAULT_CONFIG,
  DOT_STYLES,
  ECC_LEVELS,
  exportCode,
  SIZE_MAX,
  SIZE_MIN,
  SIZE_STEP,
  type QrConfig,
} from "./lib/qr";
import { ColorField, LogoField, Section, Segmented, Select, Slider } from "./components/Controls";
import { Preview } from "./components/Preview";
import { ScanRisk } from "./components/ScanRisk";

const DEBOUNCE_MS = 300;

export default function App() {
  const [config, setConfig] = useState<QrConfig>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState(DEFAULT_CONFIG.data);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function download(extension: "png" | "svg") {
    try {
      setNotice(null);
      await exportCode(config, extension);
    } catch {
      setNotice("Export failed. Try a smaller size.");
    }
  }

  return (
    <div className="flex h-full">
      {/* Control rail — 280px, separated by a single edge line. */}
      <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-edge">
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
          <ColorField
            label="Background"
            value={config.background}
            onChange={(value) => set("background", value)}
          />
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
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!ready}
              onClick={() => download("png")}
            >
              PNG
            </button>
            <button
              type="button"
              className="btn"
              disabled={!ready}
              onClick={() => download("svg")}
            >
              SVG
            </button>
          </div>
          {notice && <p className="font-mono text-[11px] leading-[1.5] text-bone">{notice}</p>}
        </Section>

        <div className="grow" />
      </aside>

      {/* Preview field. */}
      <main className="grid-field flex grow flex-col overflow-y-auto">
        <div className="flex grow items-center justify-center p-16">
          <Preview config={config} />
        </div>

        {findings.length > 0 && (
          <div className="shrink-0 px-16 pb-10">
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
    </div>
  );
}
