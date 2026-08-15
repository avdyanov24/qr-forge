import { ColorField, Field, Section, Select } from "./Controls";
import { EXPORT_DPI, px, TEMPLATES, templateById, type LayoutConfig } from "../lib/templates";

export function LayoutPanel({
  layout,
  onChange,
}: {
  layout: LayoutConfig;
  onChange: <K extends keyof LayoutConfig>(key: K, value: LayoutConfig[K]) => void;
}) {
  const template = templateById(layout.template);

  return (
    <>
      <Section title="Piece">
        <Select
          label="Template"
          value={layout.template}
          options={TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(value) => onChange("template", value)}
        />
        <Field label="Output" value={`${px(template.widthMm, EXPORT_DPI)} × ${px(template.heightMm, EXPORT_DPI)} px`}>
          <p className="font-mono text-[11px] leading-[1.5] text-ash">
            {template.widthMm} × {template.heightMm} mm at {EXPORT_DPI} dpi
          </p>
        </Field>
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
      </Section>

      <Section title="Colour">
        <ColorField
          label="Card"
          value={layout.background}
          onChange={(value) => onChange("background", value)}
        />
        <ColorField label="Ink" value={layout.ink} onChange={(value) => onChange("ink", value)} />
      </Section>
    </>
  );
}
