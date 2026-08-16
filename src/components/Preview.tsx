import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { buildOptions, describeEncodeError, PREVIEW_SIZE, type QrConfig } from "../lib/qr";

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

export function Preview({
  config,
  onEncodeError,
}: {
  config: QrConfig;
  onEncodeError: (message: string | null) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const instance = useRef<QRCodeStyling | null>(null);
  const [error, setError] = useState<string | null>(null);
  const empty = config.data.trim() === "";

  useEffect(() => {
    const node = mount.current;
    if (!node || empty) return;

    const options = buildOptions(config, PREVIEW_SIZE);

    // The encoder throws synchronously — capacity overflow is the common one.
    // Without this the throw escapes the effect and unmounts the whole app.
    try {
      if (!instance.current) {
        instance.current = new QRCodeStyling(options);
      } else {
        instance.current.update(options);
      }
      instance.current.append(node);
      fluid(node);
      setError(null);
      onEncodeError(null);
    } catch (thrown) {
      // A failed update can leave the instance mid-write, so start clean next time.
      instance.current = null;
      const message = describeEncodeError(thrown);
      setError(message);
      onEncodeError(message);
      return;
    }

    return () => {
      node.replaceChildren();
    };
  }, [config, empty, onEncodeError]);

  useEffect(() => {
    if (empty) {
      setError(null);
      onEncodeError(null);
    }
  }, [empty, onEncodeError]);

  const hidden = empty || error !== null;

  return (
    <div className="flex aspect-square w-full items-center justify-center">
      {/*
        The mount stays in the tree even while a message is showing. Swapping
        it out detaches the ref, and the effect that would clear the error can
        never run again — the code would never come back after a bad input.
      */}
      <div ref={mount} className={hidden ? "hidden" : "h-full w-full"} />
      {hidden && (
        <div className="flex h-full w-full items-center justify-center border border-edge p-6">
          {error ? (
            <p className="max-w-[320px] text-center text-[12px] leading-[1.6] text-ash">{error}</p>
          ) : (
            <span className="label">Awaiting input</span>
          )}
        </div>
      )}
    </div>
  );
}
