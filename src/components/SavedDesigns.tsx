import { useState } from "react";
import { Disclosure, Field } from "./Controls";
import type { SavedDesign } from "../lib/storage";

/** Shown inline before the rest folds behind a disclosure. */
const VISIBLE_COUNT = 3;

function when(savedAt: number): string {
  if (!savedAt) return "";
  const minutes = Math.round((Date.now() - savedAt) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function DesignRow({
  design,
  onRestore,
  onDelete,
}: {
  design: SavedDesign;
  onRestore: (design: SavedDesign) => void;
  onDelete: (design: SavedDesign) => void;
}) {
  return (
    <div className="panel flex items-center gap-2 px-3 py-2.5">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 text-left"
        onClick={() => onRestore(design)}
      >
        <span className="w-full truncate font-mono text-[12px] leading-none text-bone">
          {design.name}
        </span>
        <span className="label">
          {design.mode} · {when(design.savedAt)}
        </span>
      </button>
      <button
        type="button"
        className="cursor-pointer px-1 font-mono text-[14px] leading-none text-ash hover:text-bone"
        aria-label={`Delete ${design.name}`}
        onClick={() => onDelete(design)}
      >
        ×
      </button>
    </div>
  );
}

export function SavedDesigns({
  designs,
  supported,
  notice,
  onSave,
  onRestore,
  onDelete,
}: {
  designs: SavedDesign[];
  supported: boolean;
  notice: string | null;
  onSave: (name: string) => void;
  onRestore: (design: SavedDesign) => void;
  onDelete: (design: SavedDesign) => void;
}) {
  const [name, setName] = useState("");
  const visible = designs.slice(0, VISIBLE_COUNT);
  const rest = designs.slice(VISIBLE_COUNT);

  if (!supported) {
    return (
      <p className="text-[12px] leading-[1.6] text-ash">
        This browser is not allowing local storage, so work cannot be kept between visits.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Name">
        <div className="flex items-stretch gap-2">
          <input
            className="field"
            value={name}
            placeholder="Spring flyer"
            spellCheck={false}
            aria-label="Design name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSave(name);
                setName("");
              }
            }}
          />
          <button
            type="button"
            className="btn w-auto px-4"
            onClick={() => {
              onSave(name);
              setName("");
            }}
          >
            Save
          </button>
        </div>
      </Field>

      {notice && <p className="font-mono text-[11px] leading-[1.5] text-bone">{notice}</p>}

      {visible.length > 0 && (
        <div className="flex flex-col gap-px border border-edge">
          {visible.map((design) => (
            <DesignRow key={design.id} design={design} onRestore={onRestore} onDelete={onDelete} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <Disclosure summary={`${rest.length} more`}>
          <div className="flex flex-col gap-px border border-edge">
            {rest.map((design) => (
              <DesignRow
                key={design.id}
                design={design}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))}
          </div>
        </Disclosure>
      )}

      <p className="text-[12px] leading-[1.6] text-ash">
        Work is kept as you go, so closing the tab does not lose it. Saving by name gives you
        something to come back to — useful before applying a preset, which replaces the piece.
      </p>
    </div>
  );
}
