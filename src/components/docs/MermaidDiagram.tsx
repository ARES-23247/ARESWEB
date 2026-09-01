import { useMemo } from "react";
import {
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { parseFlowchart } from "./flowchart";

/** Diagram sources are bounded so a pathological post cannot pin the CPU. */
const MAX_FLOWCHART_SOURCE_CHARS = 8_000;
const NODE_WIDTH = 190;
const NODE_HEIGHT = 68;
const RANK_GAP = 245;
const LANE_GAP = 112;

export interface MermaidDiagramProps {
  /** Supported Mermaid flowchart source from a ```mermaid code fence. */
  code: string;
  /** Accessible summary; defaults to a `%% aria:` comment in the diagram. */
  label?: string;
}

function getAccessibleLabel(source: string, label?: string) {
  const ariaComment = source.match(/^%%\s*aria:\s*(.+)$/imu)?.[1]?.trim();
  return (
    label?.trim() ||
    ariaComment?.slice(0, 240) ||
    source.split("\n")[0]?.slice(0, 160) ||
    "Diagram"
  );
}

function nodePosition(
  direction: "LR" | "RL" | "TD" | "TB",
  rank: number,
  lane: number,
  rankCount: number,
) {
  const displayedRank = direction === "RL" ? rankCount - rank - 1 : rank;
  return direction === "LR" || direction === "RL"
    ? { x: displayedRank * RANK_GAP, y: lane * LANE_GAP }
    : { x: lane * RANK_GAP, y: rank * LANE_GAP };
}

export default function MermaidDiagram({ code, label }: MermaidDiagramProps) {
  const source = code.replace(/\u0000/gu, "").trim();
  const accessibleLabel = getAccessibleLabel(source, label);
  const parsed = useMemo(
    () =>
      source && source.length <= MAX_FLOWCHART_SOURCE_CHARS
        ? parseFlowchart(source)
        : null,
    [source],
  );

  const graph = useMemo(() => {
    if (!parsed) return null;
    const nodes: Node[] = parsed.nodes.map((node) => ({
      id: node.id,
      data: { label: node.label },
      position: nodePosition(
        parsed.direction,
        node.rank,
        node.lane,
        parsed.rankCount,
      ),
      sourcePosition:
        parsed.direction === "LR" || parsed.direction === "RL"
          ? parsed.direction === "RL"
            ? Position.Left
            : Position.Right
          : Position.Bottom,
      targetPosition:
        parsed.direction === "LR" || parsed.direction === "RL"
          ? parsed.direction === "RL"
            ? Position.Right
            : Position.Left
          : Position.Top,
      style: {
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: node.kind === "decision" ? 22 : 8,
        border:
          node.kind === "decision"
            ? "2px solid #fbbf24"
            : "1px solid #52525b",
        background: node.kind === "decision" ? "#29220d" : "#121217",
        color: "#f8fafc",
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.3,
        padding: "10px 12px",
        textAlign: "center",
      },
    }));
    const edges: Edge[] = parsed.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
      style: {
        stroke: "#a1a1aa",
        strokeWidth: 1.5,
        ...(edge.dashed ? { strokeDasharray: "6 5" } : {}),
      },
      labelStyle: { fill: "#f8fafc", fontSize: 11, fontWeight: 700 },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.95 },
      labelBgPadding: [4, 3],
    }));
    const vertical = parsed.direction === "TD" || parsed.direction === "TB";
    const primaryCount = vertical ? parsed.rankCount : parsed.laneCount;
    return {
      nodes,
      edges,
      height: Math.min(720, Math.max(260, primaryCount * LANE_GAP + 100)),
    };
  }, [parsed]);

  if (!graph) {
    return (
      <figure
        role="note"
        className="my-6 rounded-lg border border-ares-red/40 bg-ares-red/10 p-4"
      >
        <figcaption className="mb-2 text-xs font-bold uppercase tracking-wider text-ares-red">
          Flowchart could not be rendered
        </figcaption>
        <p className="mb-2 text-xs text-marble/70">
          This viewer supports bounded Mermaid flowcharts. The source remains
          available below.
        </p>
        <pre className="overflow-x-auto text-xs text-marble/80">
          <code>{source || "(empty diagram)"}</code>
        </pre>
      </figure>
    );
  }

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-white/10 bg-obsidian p-3">
      <div role="img" aria-label={accessibleLabel} title={accessibleLabel}>
        <div aria-hidden="true" style={{ height: graph.height }}>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            fitView
            fitViewOptions={{ padding: 0.18, minZoom: 0.25, maxZoom: 1 }}
            minZoom={0.25}
            maxZoom={1}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            panOnDrag={false}
            zoomOnDoubleClick={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
          />
        </div>
      </div>
      <figcaption className="sr-only">{accessibleLabel}</figcaption>
    </figure>
  );
}
