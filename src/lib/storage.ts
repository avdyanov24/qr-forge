import { DEFAULT_CONFIG, SIZE_DEFAULT, type QrConfig } from "./qr";
import { DEFAULT_LAYOUT, type LayoutConfig } from "./templates";

/**
 * Saving work to the browser.
 *
 * Two separate things live here. The workspace is written continuously so
 * closing the tab does not lose the design. Saved designs are explicit, named
 * and only written when asked for, so a preset — which overwrites the whole
 * piece — can be undone by going back to one.
 *
 * Nothing leaves the machine. This is localStorage, not a service.
 */

const WORKSPACE_KEY = "qr-forge:workspace";
const DESIGNS_KEY = "qr-forge:designs";

/** Bumped when a shape change would make old entries wrong rather than partial. */
const VERSION = 1;

export type Mode = "Code" | "Layout";

export interface Workspace {
  config: QrConfig;
  layout: LayoutConfig;
  size: number;
  mode: Mode;
}

export interface SavedDesign extends Workspace {
  id: string;
  name: string;
  savedAt: number;
}

export type SaveResult = { ok: true } | { ok: false; reason: string };

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function available(): boolean {
  try {
    const probe = "qr-forge:probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch (error) {
    // A store that is merely full still exists, and the fix for it is to free
    // space or drop a large image. Reporting that as "storage is blocked" would
    // send someone to their browser settings for no reason.
    if (isQuotaError(error)) return true;
    // Private modes and blocked storage throw rather than return false.
    return false;
  }
}

export const storageAvailable = available();

/**
 * Anything read back is untrusted: it may predate a field, or have been edited
 * by hand. Merging over the defaults means a missing key is filled rather than
 * left undefined and crashing a render deep in the canvas code.
 */
function reviveWorkspace(raw: unknown): Workspace | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Workspace> & { version?: number };
  if (value.version !== VERSION) return null;
  if (!value.config || !value.layout) return null;

  return {
    config: { ...DEFAULT_CONFIG, ...value.config },
    layout: { ...DEFAULT_LAYOUT, ...value.layout },
    size: typeof value.size === "number" ? value.size : SIZE_DEFAULT,
    mode: value.mode === "Layout" ? "Layout" : "Code",
  };
}

function write(key: string, value: unknown): SaveResult {
  if (!storageAvailable) {
    return { ok: false, reason: "This browser is not allowing local storage." };
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    // An uploaded logo or background is a data URL, and two large ones will
    // pass what a browser allows. Say which, rather than failing silently and
    // leaving someone to discover it on the next load.
    return {
      ok: false,
      reason: isQuotaError(error)
        ? "Too large to store. Uploaded images are held in full, and the browser's limit is around 5 MB."
        : "Could not write to local storage.",
    };
  }
}

function read<T>(key: string): T | null {
  if (!storageAvailable) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------- */
/* Workspace                                                              */
/* ---------------------------------------------------------------------- */

export function loadWorkspace(): Workspace | null {
  return reviveWorkspace(read<unknown>(WORKSPACE_KEY));
}

export function saveWorkspace(workspace: Workspace): SaveResult {
  return write(WORKSPACE_KEY, { version: VERSION, ...workspace });
}

export function clearWorkspace(): void {
  if (!storageAvailable) return;
  try {
    window.localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    // Nothing useful to do; the caller is resetting state anyway.
  }
}

/* ---------------------------------------------------------------------- */
/* Named designs                                                          */
/* ---------------------------------------------------------------------- */

export function loadDesigns(): SavedDesign[] {
  const raw = read<unknown[]>(DESIGNS_KEY);
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const value = entry as Partial<SavedDesign> & { version?: number };
      const workspace = reviveWorkspace(value);
      if (!workspace || typeof value.id !== "string" || typeof value.name !== "string") {
        return null;
      }
      return {
        config: workspace.config,
        layout: workspace.layout,
        size: workspace.size,
        mode: workspace.mode,
        id: value.id,
        name: value.name,
        savedAt: typeof value.savedAt === "number" ? value.savedAt : 0,
      } satisfies SavedDesign;
    })
    .filter((entry): entry is SavedDesign => entry !== null);
}

function writeDesigns(designs: SavedDesign[]): SaveResult {
  return write(
    DESIGNS_KEY,
    designs.map((design) => Object.assign({ version: VERSION }, design)),
  );
}

export function saveDesign(
  name: string,
  workspace: Workspace,
  existing: SavedDesign[],
): { result: SaveResult; designs: SavedDesign[] } {
  const trimmed = name.trim() || "Untitled";
  const design: SavedDesign = {
    ...workspace,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    savedAt: Date.now(),
  };

  // Newest first, so the list reads as a history without needing a sort control.
  const designs = [design, ...existing];
  const result = writeDesigns(designs);
  return { result, designs: result.ok ? designs : existing };
}

export function deleteDesign(
  id: string,
  existing: SavedDesign[],
): { result: SaveResult; designs: SavedDesign[] } {
  const designs = existing.filter((design) => design.id !== id);
  const result = writeDesigns(designs);
  return { result, designs: result.ok ? designs : existing };
}
