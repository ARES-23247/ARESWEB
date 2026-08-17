import React, { useEffect, useId, useRef, useState } from "react";

/** Diagram sources are bounded so a pathological post cannot pin the CPU. */
const MAX_MERMAID_SOURCE_CHARS = 8_000;

let mermaidReady: Promise<typeof import("mermaid")["default"]> | null = null;

function loadMermaid() {
  // securityLevel "strict" disables HTML labels, links, and callbacks in the
  // rendered SVG; the base theme is recolored to match the team palette.
  mermaidReady ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: "Inter, system-ui, sans-serif",
      themeVariables: {
        background: "#0b0b0e",
        primaryColor: "#121217",
        primaryTextColor: "#e2e8f0",
        primaryBorderColor: "#52525b",
        lineColor: "#71717a",
        secondaryColor: "#1c1917",
        tertiaryColor: "#0b0b0e",
      },
    });
    return mermaid;
  });
  return mermaidReady;
}

export interface MermaidDiagramProps {
  /** Mermaid diagram source (the contents of a ```mermaid code fence). */
  code: string;
  /** Accessible summary; defaults to the first line of the diagram source. */
  label?: string;
}

export default function MermaidDiagram({ code, label }: MermaidDiagramProps) {
  const reactId = useId();
  const renderCounter = useRef(0);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const source = code.replace(/\u0000/g, "").trim();
  const accessibleLabel =
    label?.trim() || source.split("\n")[0]?.slice(0, 160) || "Diagram";

  useEffect(() => {
    let cancelled = false;
    if (!source || source.length > MAX_MERMAID_SOURCE_CHARS) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setSvg(null);
    renderCounter.current += 1;
    // Unique diagram ids keep repeated rerenders from colliding in mermaid's cache.
    const diagramId = `mmd-${reactId.replace(/[^a-zA-Z0-9]/g, "")}-${renderCounter.current}`;

    loadMermaid()
      .then(async (mermaid) => {
        const { svg: rendered } = await mermaid.render(diagramId, source);
        if (!cancelled) setSvg(rendered);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [source, reactId]);

  if (failed) {
    return (
      <figure
        role="note"
        className="my-6 rounded-lg border border-ares-red/40 bg-ares-red/10 p-4"
      >
        <figcaption className="mb-2 text-xs font-bold uppercase tracking-wider text-ares-red">
          Diagram could not be rendered
        </figcaption>
        <pre className="overflow-x-auto text-xs text-marble/80">
          <code>{source || "(empty diagram)"}</code>
        </pre>
      </figure>
    );
  }

  if (svg === null) {
    return (
      <div
        role="img"
        aria-label={accessibleLabel}
        className="my-6 flex h-32 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-xs uppercase tracking-wider text-marble/50"
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <figure className="my-6 overflow-x-auto rounded-lg border border-white/10 bg-obsidian p-4">
      <div role="img" aria-label={accessibleLabel} title={accessibleLabel} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="sr-only">{source}</figcaption>
    </figure>
  );
}
