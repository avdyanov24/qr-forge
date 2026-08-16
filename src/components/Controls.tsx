import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-edge px-6 py-7">
      <h2 className="label mb-5">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label">{label}</span>
        {value !== undefined && (
          <span className="font-mono text-[11px] leading-none text-bone tabular-nums">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <select
          className="select"
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ash"
        >
          ▼
        </span>
      </div>
    </Field>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex border border-edge rounded-[2px] panel">
        {options.map((option, index) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              className={[
                "flex-1 h-[34px] font-mono text-[12px] cursor-pointer",
                index > 0 ? "border-l border-edge" : "",
                active ? "bg-edge text-bone" : "text-ash hover:text-bone",
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} value={display}>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const HEX_SHORT = /^#[0-9a-fA-F]{3}$/;

/**
 * Six-digit form of a typed colour, or null while it is still incomplete.
 * Shorthand is expanded here so everything downstream — the swatch, the
 * renderer and the contrast maths — sees one representation.
 */
export function normalizeHex(text: string): string | null {
  const value = text.trim().toUpperCase();
  if (HEX.test(value)) return value;
  if (HEX_SHORT.test(value)) {
    return `#${value
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return null;
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  // The field keeps its own text so a half-typed colour never reaches the
  // renderer. Only a complete value is published upward, and the last one
  // published is remembered so an echo of it does not clobber what is being
  // typed.
  const [draft, setDraft] = useState(value);
  const published = useRef(value);

  useEffect(() => {
    if (value !== published.current) {
      published.current = value;
      setDraft(value);
    }
  }, [value]);

  function handleText(next: string) {
    const text = next.trim() === "" || next.startsWith("#") ? next : `#${next}`;
    setDraft(text);
    const normalized = normalizeHex(text);
    if (normalized && normalized !== published.current) {
      published.current = normalized;
      onChange(normalized);
    }
  }

  function handleSwatch(next: string) {
    const normalized = next.toUpperCase();
    published.current = normalized;
    setDraft(normalized);
    onChange(normalized);
  }

  return (
    <Field label={label}>
      <div className="flex items-stretch gap-2">
        {/*
          Two controls edit the same colour, so they are named apart — a
          screen reader announcing "Foreground" twice gives no way to tell the
          swatch from the hex field.
        */}
        <label
          htmlFor={id}
          className="relative w-[38px] shrink-0 cursor-pointer border border-edge rounded-[2px] hover:border-ash"
          style={{ backgroundColor: value }}
        >
          <span className="sr-only">{label} colour picker</span>
          <input
            id={id}
            type="color"
            value={value}
            onChange={(event) => handleSwatch(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          type="text"
          className="field uppercase"
          spellCheck={false}
          value={draft}
          onChange={(event) => handleText(event.target.value)}
          aria-label={`${label} hex value`}
        />
      </div>
    </Field>
  );
}

export function LogoField({
  logo,
  onChange,
  onError,
  label = "Logo",
}: {
  logo: string | null;
  onChange: (logo: string | null) => void;
  onError: (message: string | null) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("That file is not an image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onError("Logo must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        onError(null);
        onChange(typeof reader.result === "string" ? reader.result : null);
      },
      { once: true },
    );
    reader.addEventListener("error", () => onError("Could not read that file."), { once: true });
    reader.readAsDataURL(file);
  }

  return (
    <Field label={label}>
      <div className="flex items-stretch gap-2">
        {logo && (
          <div
            className="w-[38px] shrink-0 border border-edge rounded-[2px] bg-bone bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${logo})` }}
            aria-hidden
          />
        )}
        <button type="button" className="btn" onClick={() => input.current?.click()}>
          {logo ? "Replace" : "Upload"}
        </button>
        {logo && (
          <button
            type="button"
            className="btn w-auto px-4"
            onClick={() => {
              onChange(null);
              onError(null);
              if (input.current) input.current.value = "";
            }}
          >
            Clear
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </Field>
  );
}
