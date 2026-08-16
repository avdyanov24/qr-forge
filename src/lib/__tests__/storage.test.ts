import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../qr";
import { DEFAULT_LAYOUT } from "../templates";
import type { SaveResult, Workspace } from "../storage";

/** Narrows to the failure reason, and fails loudly if the save unexpectedly worked. */
function reasonFor(result: SaveResult): string {
  if (result.ok) throw new Error("expected this save to fail, but it succeeded");
  return result.reason;
}

/**
 * storage.ts probes for localStorage when it loads, so each test installs its
 * own stub and re-imports the module. Filling a real browser's quota is not
 * reproducible — the failure path is reached here by making setItem throw the
 * exception a browser would.
 */
function installStorage(overrides: Partial<Storage> = {}) {
  const data = new Map<string, string>();
  const store: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
    ...overrides,
  };
  vi.stubGlobal("window", { localStorage: store });
  return { store, data };
}

const workspace = (): Workspace => ({
  config: { ...DEFAULT_CONFIG, data: "https://example.com/saved" },
  layout: { ...DEFAULT_LAYOUT, headline: "Saved headline" },
  size: 1536,
  mode: "Layout",
});

async function freshModule() {
  vi.resetModules();
  return import("../storage");
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("workspace round trip", () => {
  it("returns what was saved", async () => {
    installStorage();
    const storage = await freshModule();

    expect(storage.saveWorkspace(workspace()).ok).toBe(true);
    const loaded = storage.loadWorkspace();
    expect(loaded?.config.data).toBe("https://example.com/saved");
    expect(loaded?.layout.headline).toBe("Saved headline");
    expect(loaded?.size).toBe(1536);
    expect(loaded?.mode).toBe("Layout");
  });

  it("returns null when nothing has been saved", async () => {
    installStorage();
    const storage = await freshModule();
    expect(storage.loadWorkspace()).toBeNull();
  });

  it("clears cleanly", async () => {
    installStorage();
    const storage = await freshModule();
    storage.saveWorkspace(workspace());
    storage.clearWorkspace();
    expect(storage.loadWorkspace()).toBeNull();
  });
});

describe("reading back untrusted data", () => {
  it("ignores entries written by an older shape", async () => {
    const { store } = installStorage();
    const storage = await freshModule();
    store.setItem(
      "qr-forge:workspace",
      JSON.stringify({ version: 0, config: DEFAULT_CONFIG, layout: DEFAULT_LAYOUT }),
    );
    expect(storage.loadWorkspace()).toBeNull();
  });

  it("survives text that is not JSON", async () => {
    const { store } = installStorage();
    const storage = await freshModule();
    store.setItem("qr-forge:workspace", "{not json");
    expect(storage.loadWorkspace()).toBeNull();
  });

  it("fills in fields a saved design predates, rather than returning undefined", async () => {
    // A design saved before a control existed must still open, with the new
    // control at its default — not crash a render on a missing value.
    const { store } = installStorage();
    const storage = await freshModule();
    store.setItem(
      "qr-forge:workspace",
      JSON.stringify({
        version: 1,
        config: { data: "https://example.com/old" },
        layout: { headline: "Old" },
      }),
    );
    const loaded = storage.loadWorkspace();
    expect(loaded?.config.data).toBe("https://example.com/old");
    expect(loaded?.config.ecc).toBe(DEFAULT_CONFIG.ecc);
    expect(loaded?.layout.pattern).toBe(DEFAULT_LAYOUT.pattern);
    expect(loaded?.size).toBeTypeOf("number");
  });

  it("drops malformed saved designs but keeps the good ones", async () => {
    const { store } = installStorage();
    const storage = await freshModule();
    store.setItem(
      "qr-forge:designs",
      JSON.stringify([
        { version: 1, id: "a", name: "Good", config: DEFAULT_CONFIG, layout: DEFAULT_LAYOUT },
        { version: 1, name: "No id", config: DEFAULT_CONFIG, layout: DEFAULT_LAYOUT },
        "not an object",
      ]),
    );
    const designs = storage.loadDesigns();
    expect(designs).toHaveLength(1);
    expect(designs[0].name).toBe("Good");
  });

  it("returns an empty list when the designs key holds something else", async () => {
    const { store } = installStorage();
    const storage = await freshModule();
    store.setItem("qr-forge:designs", JSON.stringify({ not: "an array" }));
    expect(storage.loadDesigns()).toEqual([]);
  });
});

describe("named designs", () => {
  it("saves newest first so the list reads as a history", async () => {
    installStorage();
    const storage = await freshModule();
    const first = storage.saveDesign("First", workspace(), []);
    const second = storage.saveDesign("Second", workspace(), first.designs);
    expect(second.designs.map((d) => d.name)).toEqual(["Second", "First"]);
  });

  it("falls back to a name rather than saving a blank one", async () => {
    installStorage();
    const storage = await freshModule();
    expect(storage.saveDesign("   ", workspace(), []).designs[0].name).toBe("Untitled");
  });

  it("deletes only the one asked for", async () => {
    installStorage();
    const storage = await freshModule();
    const saved = storage.saveDesign("Keep", workspace(), []);
    const withTwo = storage.saveDesign("Remove", workspace(), saved.designs);
    const target = withTwo.designs.find((d) => d.name === "Remove")!;
    const after = storage.deleteDesign(target.id, withTwo.designs);
    expect(after.designs.map((d) => d.name)).toEqual(["Keep"]);
  });
});

/** setItem that behaves like a browser whose store is full. */
const quota = () => () => {
  throw new DOMException("full", "QuotaExceededError");
};

/** setItem that behaves like storage being blocked outright. */
const blocked = () => () => {
  throw new Error("blocked");
};

describe("when the browser refuses to store", () => {
  it("reports a full store instead of failing silently", async () => {
    installStorage({ setItem: quota() });
    const storage = await freshModule();
    expect(reasonFor(storage.saveWorkspace(workspace()))).toMatch(/too large/i);
  });

  it("mentions that uploaded images are the usual cause", async () => {
    installStorage({ setItem: quota() });
    const storage = await freshModule();
    expect(reasonFor(storage.saveWorkspace(workspace()))).toMatch(/image/i);
  });

  it("keeps the existing list when a save cannot be written", async () => {
    installStorage({ setItem: quota() });
    const storage = await freshModule();
    const { result, designs } = storage.saveDesign("Doomed", workspace(), []);
    expect(result.ok).toBe(false);
    // Returning the new list would show an entry that was never stored.
    expect(designs).toEqual([]);
  });

  it("reports storage being unavailable at all", async () => {
    installStorage({ setItem: blocked() });
    const storage = await freshModule();
    expect(storage.storageAvailable).toBe(false);
    expect(reasonFor(storage.saveWorkspace(workspace()))).toMatch(/not allowing/i);
  });

  it("loads nothing rather than throwing when storage is unavailable", async () => {
    installStorage({ setItem: blocked() });
    const storage = await freshModule();
    expect(storage.loadWorkspace()).toBeNull();
    expect(storage.loadDesigns()).toEqual([]);
  });
});
