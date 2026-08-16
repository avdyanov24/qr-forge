import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeRisk,
  CORNER_DOT_STYLES,
  CORNER_STYLES,
  DEFAULT_CONFIG,
  DOT_STYLES,
  ECC_GUIDE,
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
import {
  ColorField,
  Disclosure,
  LogoField,
  Section,
  Segmented,
  Select,
  Slider,
} from "./components/Controls";
import { ExportActions } from "./components/ExportActions";
import { LayoutPanel } from "./components/LayoutPanel";
import { Preview } from "./components/Preview";
import { ScanRisk } from "./components/ScanRisk";
import { TemplatePreview } from "./components/TemplatePreview";
import { StressTest } from "./components/StressTest";
import { ThemeToggle } from "./components/ThemeToggle";
import { PresetGrid } from "./components/PresetGrid";
import { SavedDesigns } from "./components/SavedDesigns";
import { applyPresetToCode, applyPresetToPiece, type Preset } from "./lib/presets";
import {
  clearWorkspace,
  deleteDesign,
  loadDesigns,
  loadWorkspace,
  saveDesign,
  saveWorkspace,
  storageAvailable,
  type SavedDesign,
} from "./lib/storage";
import { runStressTest, stressTestSupported, type StressReport } from "./lib/stress";
import { ZOOM_FIT, ZoomControl } from "./components/ZoomControl";

const DEBOUNCE_MS = 300;

type Mode = "Code" | "Layout";

// Read once, before first render, so the interface never paints the defaults
// and then jump to the restored design.
const restored = loadWorkspace();

export default function App() {
  const [config, setConfig] = useState<QrConfig>(restored?.config ?? DEFAULT_CONFIG);
  const [draft, setDraft] = useState(restored?.config.data ?? DEFAULT_CONFIG.data);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<FileExtension | null>(null);
  const [mode, setMode] = useState<Mode>(restored?.mode ?? "Code");
  const [layout, setLayout] = useState<LayoutConfig>(restored?.layout ?? DEFAULT_LAYOUT);
  const [designs, setDesigns] = useState<SavedDesign[]>(() => loadDesigns());
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [moduleCount, setModuleCount] = useState<number | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(ZOOM_FIT);
  // Kept out of config on purpose — see SIZE_DEFAULT in lib/qr.
  const [size, setSize] = useState(restored?.size ?? SIZE_DEFAULT);
  const [stress, setStress] = useState<StressReport | null>(null);
  const [stressRunning, setStressRunning] = useState(false);

  // The report describes one specific design, so it is dropped the moment the
  // design changes rather than left on screen claiming to still be true.
  useEffect(() => {
    setStress(null);
  }, [config]);

  // Keep the working state, debounced so dragging a slider does not write on
  // every step. A failure here is reported rather than swallowed: silently
  // losing work is the one thing this is supposed to prevent.
  useEffect(() => {
    const timer = setTimeout(() => {
      const result = saveWorkspace({ config, layout, size, mode });
      setStorageNotice(result.ok ? null : result.reason);
    }, 400);
    return () => clearTimeout(timer);
  }, [config, layout, size, mode]);

  function usePreset(preset: Preset) {
    // Functional updates, so a preset applied within the text debounce cannot
    // rebuild from a snapshot that predates the pending text.
    setConfig((current) => applyPresetToCode(preset, current));
    setLayout((current) => applyPresetToPiece(preset, current));
    setPresetId(preset.id);
  }

  function storeDesign(name: string) {
    const { result, designs: next } = saveDesign(name, { config, layout, size, mode }, designs);
    setDesigns(next);
    setStorageNotice(result.ok ? null : result.reason);
  }

  function restoreDesign(design: SavedDesign) {
    setConfig(design.config);
    setDraft(design.config.data);
    setLayout(design.layout);
    setSize(design.size);
    setMode(design.mode);
    setPresetId(null);
  }

  function removeDesign(design: SavedDesign) {
    const { result, designs: next } = deleteDesign(design.id, designs);
    setDesigns(next);
    setStorageNotice(result.ok ? null : result.reason);
  }

  function resetAll() {
    clearWorkspace();
    setConfig(DEFAULT_CONFIG);
    setDraft(DEFAULT_CONFIG.data);
    setLayout(DEFAULT_LAYOUT);
    setSize(SIZE_DEFAULT);
    setPresetId(null);
    setStorageNotice(null);
  }

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
      {/*
        `relative` is load-bearing. Visually hidden labels use position:
        absolute, and an absolutely positioned element is only clipped by an
        ancestor's overflow if that ancestor is its containing block. Without
        this the hidden radio inputs escape the rail and sit at their static
        position in page coordinates, stretching the document and letting the
        whole page scroll past the interface.
      */}
      <aside className="relative order-2 flex w-full shrink-0 flex-col border-t border-edge lg:order-1 lg:w-[280px] lg:overflow-y-auto lg:border-t-0 lg:border-r">
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

        <Section title="Style">
          <PresetGrid activeId={presetId} onApply={usePreset} />
        </Section>

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
              <p className="-mt-2 text-[12px] leading-[1.6] text-ash">
                Level {config.ecc} rebuilds the code after losing{" "}
                <span className="text-bone">{ECC_GUIDE[config.ecc].recovers}</span> of it — for{" "}
                {ECC_GUIDE[config.ecc].use}.
              </p>

              <Disclosure summary="What that means">
                <p>
                  A QR code carries more than your text. The extra is computed from it, so a reader
                  that recovers enough of the pattern can rebuild the parts it could not see. It is
                  not a spare copy — it is closer to solving for a missing number.
                </p>
                <p>
                  Damage is spread on purpose. The data is cut into blocks and interleaved across
                  the grid, so a thumb over one corner takes a small bite out of many blocks rather
                  than destroying one outright. That is why a scuffed code still scans.
                </p>
                <p>
                  <span className="text-bone">
                    The three corner squares are not covered by any of this.
                  </span>{" "}
                  A reader uses them to find the code before decoding starts. Wash them out and the
                  code is not recovered with difficulty — it is never found at all.
                </p>
                <p>
                  Raising the level is not free. It leaves less room for your text, so the same
                  content needs a denser grid, and at a fixed printed size every module gets
                  physically smaller. On a small piece with a long link, H can scan worse than M.
                </p>
                <p>
                  Shortening the text helps twice — bigger modules and more headroom. Raising the
                  level helps once and costs you module size.
                </p>
              </Disclosure>
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

        <Section title="Saved work">
          <SavedDesigns
            designs={designs}
            supported={storageAvailable}
            notice={storageNotice}
            onSave={storeDesign}
            onRestore={restoreDesign}
            onDelete={removeDesign}
          />
          <button type="button" className="btn" onClick={resetAll}>
            Reset to defaults
          </button>
        </Section>

        <div className="grow" />
      </aside>

      {/* Preview field. */}
      {/* Same reasoning as the rail: it scrolls, so it must contain its own absolutes. */}
      <main className="grid-field relative order-1 flex grow flex-col lg:order-2 lg:overflow-y-auto">
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

        {/*
          Wraps as whole rows rather than letting the readout break mid-line.
          With two controls beside it there is not enough width on a phone, and
          a three-line readout reads as an accident.
        */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-edge px-6 py-3">
          <p className="font-mono text-[11px] leading-none text-ash whitespace-nowrap tabular-nums">
            {mode === "Layout" ? layoutReadout : codeReadout}
          </p>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ZoomControl zoom={zoom} onChange={setZoom} />
          </div>
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
