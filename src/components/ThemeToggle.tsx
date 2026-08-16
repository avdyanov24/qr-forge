import { useId, useState } from "react";

export type Theme = "dark" | "light";

/** Whatever index.html stamped before paint, which follows the system. */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const name = useId();

  function choose(next: Theme) {
    const root = document.documentElement;

    // Swap with transitions suppressed. A property transitioning from a custom
    // property that changed on an ancestor does not reliably re-run, which left
    // buttons stuck on the old accent; the forced reflow commits the new palette
    // before transitions come back. Synchronous on purpose — a timer or a frame
    // callback would leave a window where the old colours are still painted, and
    // requestAnimationFrame does not fire at all in a hidden tab.
    root.setAttribute("data-theme-switching", "");
    root.dataset.theme = next;
    void root.offsetWidth;
    root.removeAttribute("data-theme-switching");

    setTheme(next);
  }

  // Native radios, same as the segmented controls in the rail: one tab stop,
  // arrow keys, and correct grouping without any of it written here.
  return (
    <fieldset className="flex items-center border border-edge">
      <legend className="sr-only">Colour theme</legend>
      {(["dark", "light"] as Theme[]).map((option, index) => {
        const active = option === theme;
        return (
          <label
            key={option}
            className={[
              "flex h-[26px] cursor-pointer items-center px-3 font-mono text-[11px] leading-none capitalize",
              index > 0 ? "border-l border-edge" : "",
              active ? "text-bone" : "text-ash hover:text-bone",
              "has-[:focus-visible]:text-signal",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={active}
              onChange={() => choose(option)}
              className="sr-only"
            />
            {option}
          </label>
        );
      })}
    </fieldset>
  );
}
