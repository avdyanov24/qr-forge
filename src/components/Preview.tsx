import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";
import { buildOptions, PREVIEW_SIZE, type QrConfig } from "../lib/qr";

/**
 * The library writes fixed width/height onto the element it appends. Strip
 * that so the code scales to whatever the preview field gives it.
 */
function fluid(mount: HTMLDivElement) {
  const child = mount.firstElementChild as HTMLElement | null;
  if (!child) return;
  if (child instanceof SVGElement) {
    child.setAttribute("viewBox", `0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`);
    child.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }
  child.style.width = "100%";
  child.style.height = "100%";
  child.style.display = "block";
}

export function Preview({ config }: { config: QrConfig }) {
  const mount = useRef<HTMLDivElement>(null);
  const instance = useRef<QRCodeStyling | null>(null);
  const empty = config.data.trim() === "";

  useEffect(() => {
    const node = mount.current;
    if (!node || empty) return;

    const options = buildOptions(config, PREVIEW_SIZE);

    if (!instance.current) {
      instance.current = new QRCodeStyling(options);
    } else {
      instance.current.update(options);
    }

    instance.current.append(node);
    fluid(node);

    return () => {
      node.replaceChildren();
    };
  }, [config, empty]);

  return (
    <div className="flex aspect-square w-full max-w-[540px] items-center justify-center">
      {empty ? (
        <div className="flex h-full w-full items-center justify-center border border-edge">
          <span className="label">Awaiting input</span>
        </div>
      ) : (
        <div ref={mount} className="h-full w-full" />
      )}
    </div>
  );
}
