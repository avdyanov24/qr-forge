import {
  ColorField,
  Disclosure,
  Field,
  LogoField,
  Section,
  Segmented,
  Select,
  Slider,
} from "./Controls";
import { PATTERNS, PLACEMENTS } from "../lib/patterns";
import {
  ALIGNMENTS,
  COMPOSITIONS,
  DEFAULT_LAYOUT,
  detailSizeMm,
  EXPORT_DPI,
  headlineSizeMm,
  marginMm,
  planSheet,
  px,
  qrWidthMm,
  subSizeMm,
  TEMPLATES,
  templateById,
  type Align,
  type LayoutConfig,
} from "../lib/templates";

export function LayoutPanel({
  layout,
  onChange,
  onError,
}: {
  layout: LayoutConfig;
  onChange: <K extends keyof LayoutConfig>(key: K, value: LayoutConfig[K]) => void;
  onError: (message: string | null) => void;
}) {
  const template = templateById(layout.template);
  const plan = planSheet(layout);
  const usesImage = layout.pattern === "image";
  const patterned = layout.pattern !== "none";

  return (
    <>
      <Section title="Piece">
        <Select
          label="Template"
          value={layout.template}
          options={TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(value) => onChange("template", value)}
        />
        <Field
          label="Output"
          value={`${px(template.widthMm, EXPORT_DPI)} × ${px(template.heightMm, EXPORT_DPI)} px`}
        >
          <p className="font-mono text-[11px] leading-[1.5] text-ash">
            {template.widthMm} × {template.heightMm} mm at {EXPORT_DPI} dpi
          </p>
        </Field>

        <Disclosure
          summary="Margin & finish"
          defaultOpen={
            layout.marginScale !== DEFAULT_LAYOUT.marginScale ||
            layout.cornerRadiusMm !== DEFAULT_LAYOUT.cornerRadiusMm ||
            layout.qrRadiusMm !== DEFAULT_LAYOUT.qrRadiusMm ||
            layout.keyline !== DEFAULT_LAYOUT.keyline
          }
        >
          <Slider
            label="Margin"
            value={layout.marginScale}
            min={0.1}
            max={2}
            step={0.05}
            display={`${marginMm(layout, template).toFixed(1)} mm`}
            onChange={(value) => onChange("marginScale", value)}
          />
          <Slider
            label="Corner radius"
            value={layout.cornerRadiusMm}
            min={0}
            max={12}
            step={0.5}
            display={`${layout.cornerRadiusMm} mm`}
            onChange={(value) => onChange("cornerRadiusMm", value)}
          />
          <Slider
            label="Code corners"
            value={layout.qrRadiusMm}
            min={0}
            max={16}
            step={0.5}
            display={`${layout.qrRadiusMm} mm`}
            onChange={(value) => onChange("qrRadiusMm", value)}
          />
          <Segmented
            label="Keyline"
            value={layout.keyline ? "On" : "Off"}
            options={["Off", "On"]}
            onChange={(value) => onChange("keyline", value === "On")}
          />
        </Disclosure>
      </Section>

      <Section title="Arrangement">
        <Select
          label="Composition"
          value={layout.composition}
          options={COMPOSITIONS}
          onChange={(value) => onChange("composition", value)}
        />
        <Segmented
          label="Alignment"
          value={layout.align}
          options={ALIGNMENTS as Align[]}
          onChange={(value) => onChange("align", value)}
        />
        <Slider
          label="Code size"
          value={layout.qrScale}
          min={0.5}
          max={1.6}
          step={0.05}
          display={`${qrWidthMm(layout, template).toFixed(0)} mm`}
          onChange={(value) => onChange("qrScale", value)}
        />
      </Section>

      <Section title="Copy">
        <Field label="Headline">
          <input
            className="field"
            value={layout.headline}
            spellCheck={false}
            placeholder="Scan me"
            onChange={(event) => onChange("headline", event.target.value)}
            aria-label="Headline"
          />
        </Field>
        <Field label="Supporting line">
          <input
            className="field"
            value={layout.sub}
            spellCheck={false}
            placeholder="example.com"
            onChange={(event) => onChange("sub", event.target.value)}
            aria-label="Supporting line"
          />
        </Field>

        <Disclosure
          summary="Text size & detail line"
          defaultOpen={
            layout.headlineScale !== DEFAULT_LAYOUT.headlineScale ||
            layout.subScale !== DEFAULT_LAYOUT.subScale ||
            layout.detail.trim() !== "" ||
            layout.detailScale !== DEFAULT_LAYOUT.detailScale
          }
        >
          <Slider
            label="Headline size"
            value={layout.headlineScale}
            min={0.6}
            max={2}
            step={0.05}
            display={`${headlineSizeMm(layout, template).toFixed(1)} mm`}
            onChange={(value) => onChange("headlineScale", value)}
          />
          <Slider
            label="Supporting line size"
            value={layout.subScale}
            min={0.6}
            max={2}
            step={0.05}
            display={`${subSizeMm(layout, template).toFixed(1)} mm`}
            onChange={(value) => onChange("subScale", value)}
          />
          <Field label="Detail line">
            <input
              className="field"
              value={layout.detail}
              spellCheck={false}
              placeholder="phone · email · website"
              onChange={(event) => onChange("detail", event.target.value)}
              aria-label="Detail line"
            />
          </Field>
          {layout.detail.trim() !== "" && (
            <Slider
              label="Detail line size"
              value={layout.detailScale}
              min={0.6}
              max={2}
              step={0.05}
              display={`${detailSizeMm(layout, template).toFixed(1)} mm`}
              onChange={(value) => onChange("detailScale", value)}
            />
          )}
        </Disclosure>

        <LogoField
          label="Piece logo"
          logo={layout.logo}
          onChange={(value) => onChange("logo", value)}
          onError={onError}
        />
        {layout.logo && (
          <Slider
            label="Logo width"
            value={layout.logoScale}
            min={0.1}
            max={0.7}
            step={0.05}
            display={`${(template.widthMm * layout.logoScale).toFixed(0)} mm`}
            onChange={(value) => onChange("logoScale", value)}
          />
        )}
      </Section>

      <Section title="Colour">
        <ColorField
          label="Card"
          value={layout.background}
          onChange={(value) => onChange("background", value)}
        />
        <ColorField label="Ink" value={layout.ink} onChange={(value) => onChange("ink", value)} />
      </Section>

      <Section title="Background">
        <Select
          label="Pattern"
          value={layout.pattern}
          options={PATTERNS}
          onChange={(value) => onChange("pattern", value)}
        />
        {usesImage && (
          <LogoField
            label="Image"
            logo={layout.backgroundImage}
            onChange={(value) => onChange("backgroundImage", value)}
            onError={onError}
          />
        )}
        {patterned && (
          <Select
            label="Placement"
            value={layout.patternPlacement}
            options={PLACEMENTS}
            onChange={(value) => onChange("patternPlacement", value)}
          />
        )}
        {patterned && !usesImage && (
          <>
            <ColorField
              label="Pattern colour"
              value={layout.patternColor}
              onChange={(value) => onChange("patternColor", value)}
            />
            <Slider
              label="Pattern scale"
              value={layout.patternScale}
              min={0.4}
              max={2}
              step={0.1}
              display={`${layout.patternScale.toFixed(1)}×`}
              onChange={(value) => onChange("patternScale", value)}
            />
          </>
        )}
        {patterned && (
          <Slider
            label="Pattern strength"
            value={layout.patternOpacity}
            min={0.05}
            max={1}
            step={0.05}
            display={`${Math.round(layout.patternOpacity * 100)}%`}
            onChange={(value) => onChange("patternOpacity", value)}
          />
        )}
      </Section>

      <Section title="Production">
        <Segmented
          label="Bleed"
          value={layout.bleedMm > 0 ? "3 mm" : "None"}
          options={["None", "3 mm"]}
          onChange={(value) => onChange("bleedMm", value === "3 mm" ? 3 : 0)}
        />
        {layout.bleedMm > 0 && (
          <Segmented
            label="Crop marks"
            value={layout.cropMarks ? "On" : "Off"}
            options={["Off", "On"]}
            onChange={(value) => onChange("cropMarks", value === "On")}
          />
        )}
        <Segmented
          label="Export as"
          value={layout.sheet === "a4" ? "A4 sheet" : "One piece"}
          options={["One piece", "A4 sheet"]}
          onChange={(value) => onChange("sheet", value === "A4 sheet" ? "a4" : "single")}
        />
        {layout.sheet === "a4" && (
          <Field label="Per sheet" value={`${plan.perSheet}`}>
            <p className="font-mono text-[11px] leading-[1.5] text-ash">
              {plan.perSheet > 0
                ? `${plan.columns} × ${plan.rows} on A4, with cut guides`
                : "This piece is too large to tile on A4"}
            </p>
          </Field>
        )}
      </Section>
    </>
  );
}
