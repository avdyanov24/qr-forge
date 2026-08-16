import { useCallback, useEffect, useMemo, useState } from "react";
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
  SIZE_DEFAULT,
  SIZE_MAX,
  SIZE_MIN,
  SIZE_STEP,
  type FileExtension,
  type GradientType,
  type QrConfig,
} from "./lib/qr";
import {
  analyzePrintRisk,
  DEFAULT_LAYOUT,
  EXPORT_DPI,
  moduleSizeMm,
  renderSheet,
  renderTemplate,
  templateById,
  type LayoutConfig,
} from "./lib/templates";
import QRCodeStyling from "qr-code-styling";
import { buildOptions, downloadBlob } from "./lib/qr";
import { ColorField, LogoField, Section, Segmented, Select, Slider } from "./components/Controls";
import { ExportActions } from "./components/ExportActions";
import { LayoutPanel } from "./components/LayoutPanel";
import { Preview } from "./components/Preview";
import { ScanRisk } from "./components/ScanRisk";
import { TemplatePreview } from "./components/TemplatePreview";
import { StressTest } from "./components/StressTest";
import { runStressTest, stressTestSupported, type StressReport } from "./lib/stress";
import { ZOOM_FIT, ZoomControl } from "./components/ZoomControl";

const DEBOUNCE_MS = 300;

type Mode = "Code" | "Layout";

export default function App() {
  const [config, setConfig] = useState<QrConfig>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState(DEFAULT_CONFIG.data);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<FileExtension | null>(null);
  const [mode, setMode] = useState<Mode>("Code");
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT);
  const [moduleCount, setModuleCount] = useState<number | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(ZOOM_FIT);
  // Kept out of config on purpose — see SIZE_DEFAULT in lib/qr.
  const [size, setSize] = useState(SIZE_DEFAULT);
  const [stress, setStress] = useState<StressReport | null>(null);
  const [stressRunning, setStressRunning] = useState(false);

  // The report describes one specific design, so it is dropped the moment the
  // design changes rather than left on screen claiming to still be true.
  useEffect(() => {
    setStress(null);
  }, [config]);

  async function runStress() {
    setStressRunning(true);
    try {
      const instance = new QRCodeStyling(buildOptions(config, 600));
      const blob = (await instance.getRawData("png")) as Blob | null;
      if (!blob) throw new Error("Could not render the code.");
      const bitmap = await createImageBitmap(blob);
      setStress(await runStressTest(bitmap, config.data));
    } catch {
      setNotice("Could not run the stress test.");
    } finally {
      setStressRunning(false);
    }
  }

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

  const setLayoutValue = useCallback(
    <K extends keyof LayoutConfig>(key: K, value: LayoutConfig[K]) =>
      setLayout((current) => ({ ...current, [key]: value })),
    [],
  );

  const codeFindings = useMemo(() => analyzeRisk(config), [config]);
  const printFindings = useMemo(
    () => (mode === "Layout" ? analyzePrintRisk(config, layout, moduleCount) : []),
    [mode, config, layout, moduleCount],
  );
  const findings = [...printFindings, ...codeFindings];
  // Nothing is exportable while the encoder is rejecting the input.
  const ready = config.data.trim() !== "" && encodeError === null;

  const codeReadout = `${size} × ${size} · ECC ${config.ecc} · ${new TextEncoder().encode(config.data).length} bytes`;

  const template = templateById(layout.template);
  // Width the preview settles at before zoom is applied.
  const fitWidth = mode === "Layout" ? template.widthMm * 4 : 540;
  const module = moduleSizeMm(config, template, moduleCount, layout);
  const layoutReadout = `${template.widthMm} × ${template.heightMm} mm · ${EXPORT_DPI} dpi${
    module ? ` · ${module.toFixed(2)} mm per module` : ""
  }`;

  async function downloadLayout() {
    if (pending) return;
    setNotice(null);
    setPending("png");
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const sheet = layout.sheet === "a4";
      const { blob } = sheet
        ? await renderSheet(config, layout, EXPORT_DPI)
        : await renderTemplate(config, layout, EXPORT_DPI);
      const suffix = sheet ? "a4-sheet" : `${EXPORT_DPI}dpi`;
      downloadBlob(blob, `qr-${layout.template}-${suffix}.png`);
    } catch {
      setNotice("Export failed. Try a smaller template.");
    } finally {
      setPending(null);
    }
  }

  async function download(extension: FileExtension) {
    if (pending) return;
    setNotice(null);
    setPending(extension);
    try {
      // Yield so the pending state paints before the thread blocks. This is a
      // timeout rather than requestAnimationFrame, which never fires while the
      // tab is hidden and would strand the export mid-flight.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await exportCode(config, size, extension);
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
          <div className="mt-6">
            <Segmented
              label="Mode"
              value={mode}
              options={["Code", "Layout"] as Mode[]}
              onChange={setMode}
            />
          </div>
        </header>

        {mode === "Layout" && (
          <LayoutPanel layout={layout} onChange={setLayoutValue} onError={setNotice} />
        )}

        {mode === "Code" && (
          <>
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
                    onChange={(value) => set("gradient", { ...config.gradient!, color: value })}
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

            <Section title="Proof">
              <StressTest
                report={stress}
                running={stressRunning}
                supported={stressTestSupported()}
                disabled={!ready}
                onRun={runStress}
              />
            </Section>

            <Section title="Output">
              <Slider
                label="Size"
                value={size}
                min={SIZE_MIN}
                max={SIZE_MAX}
                step={SIZE_STEP}
                display={`${size} px`}
                onChange={setSize}
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
          </>
        )}

        {mode === "Layout" && (
          <Section title="Export">
            <div className="hidden lg:block">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!ready || pending !== null}
                onClick={downloadLayout}
              >
                {pending ? "Rendering" : `PNG ${EXPORT_DPI} dpi`}
              </button>
              {notice && (
                <p className="mt-2 font-mono text-[11px] leading-[1.5] text-bone">{notice}</p>
              )}
            </div>
          </Section>
        )}

        <div className="grow" />
      </aside>

      {/* Preview field. */}
      <main className="grid-field order-1 flex grow flex-col lg:order-2 lg:overflow-y-auto">
        {/*
          The zoomed piece can exceed the field, so this scrolls. Width is the
          fitted size multiplied by the zoom factor, which keeps the SVG and
          the rendered layout sharp instead of scaling a bitmap.
        */}
        <div className="flex grow overflow-auto p-5 sm:p-10 lg:p-16">
          <div
            className="m-auto shrink-0"
            style={{ width: `calc(min(100%, ${fitWidth}px) * ${zoom})` }}
          >
            {mode === "Layout" ? (
              <TemplatePreview
                config={config}
                layout={layout}
                onRender={setModuleCount}
                onEncodeError={setEncodeError}
              />
            ) : (
              <Preview config={config} onEncodeError={setEncodeError} />
            )}
          </div>
        </div>

        {findings.length > 0 && (
          <div className="shrink-0 px-5 pb-8 sm:px-10 lg:px-16 lg:pb-10">
            <div className="mx-auto max-w-[540px]">
              <ScanRisk findings={findings} />
            </div>
          </div>
        )}

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-edge px-6 py-3">
          <p className="font-mono text-[11px] leading-none text-ash tabular-nums">
            {mode === "Layout" ? layoutReadout : codeReadout}
          </p>
          <ZoomControl zoom={zoom} onChange={setZoom} />
        </footer>
      </main>

      {/*
        Stacked, the rail runs long enough to bury the export controls, so
        below lg they dock to the bottom of the viewport instead.
      */}
      <div className="sticky bottom-0 order-3 border-t border-edge bg-void px-5 py-4 lg:hidden">
        {mode === "Layout" ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!ready || pending !== null}
              onClick={downloadLayout}
            >
              {pending ? "Rendering" : `PNG ${EXPORT_DPI} dpi`}
            </button>
            {notice && (
              <p className="mt-2 font-mono text-[11px] leading-[1.5] text-bone">{notice}</p>
            )}
          </>
        ) : (
          <ExportActions ready={ready} pending={pending} notice={notice} onExport={download} />
        )}
      </div>
    </div>
  );
}
