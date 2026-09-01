export type FlowchartDirection = "LR" | "RL" | "TD" | "TB";

export interface FlowchartNode {
  id: string;
  label: string;
  kind: "process" | "decision";
  rank: number;
  lane: number;
}

export interface FlowchartEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  dashed: boolean;
}

export interface ParsedFlowchart {
  direction: FlowchartDirection;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  rankCount: number;
  laneCount: number;
}

interface NodeDefinition {
  id: string;
  label: string;
  kind: "process" | "decision";
}

interface EdgeSplit {
  left: string;
  right: string;
  label?: string;
  dashed: boolean;
}

function cleanEdgeLabel(value: string) {
  const trimmed = value.trim();
  const unquoted =
    trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1)
      : trimmed;
  return unquoted.trim().slice(0, 120);
}

function parseNode(token: string): NodeDefinition | null {
  const value = token.trim();
  const id = value.match(/^[A-Za-z][A-Za-z0-9_-]*/u)?.[0];
  if (!id) return null;
  const shape = value.slice(id.length).trim();
  if (!shape) return { id, label: id, kind: "process" };
  const isProcess = shape.startsWith('["') && shape.endsWith('"]');
  const isDecision = shape.startsWith('{"') && shape.endsWith('"}');
  if (!isProcess && !isDecision) return null;
  const rawLabel = shape.slice(2, -2);
  return {
    id,
    label: rawLabel
      .replaceAll("\\n", " ")
      .replaceAll('\\"', '"')
      .trim()
      .slice(0, 240),
    kind: isDecision ? "decision" : "process",
  };
}

function splitEdge(line: string): EdgeSplit | null {
  const dottedStart = line.indexOf("-.");
  if (dottedStart >= 0) {
    const dottedEnd = line.indexOf(".->", dottedStart + 2);
    if (dottedEnd < 0) return null;
    const label = cleanEdgeLabel(line.slice(dottedStart + 2, dottedEnd));
    return {
      left: line.slice(0, dottedStart),
      right: line.slice(dottedEnd + 3),
      ...(label ? { label } : {}),
      dashed: true,
    };
  }

  const arrow = line.indexOf("-->");
  if (arrow < 0) return null;
  const beforeArrow = line.slice(0, arrow);
  const branchStart = beforeArrow.lastIndexOf("--");
  if (branchStart >= 0) {
    const label = cleanEdgeLabel(beforeArrow.slice(branchStart + 2));
    return {
      left: beforeArrow.slice(0, branchStart),
      right: line.slice(arrow + 3),
      ...(label ? { label } : {}),
      dashed: false,
    };
  }

  let right = line.slice(arrow + 3).trim();
  let label: string | undefined;
  if (right.startsWith("|")) {
    const labelEnd = right.indexOf("|", 1);
    if (labelEnd < 0) return null;
    label = cleanEdgeLabel(right.slice(1, labelEnd));
    right = right.slice(labelEnd + 1);
  }
  return {
    left: beforeArrow,
    right,
    ...(label ? { label } : {}),
    dashed: false,
  };
}

function assignLayout(
  definitions: NodeDefinition[],
  edges: Omit<FlowchartEdge, "id">[],
): Pick<ParsedFlowchart, "nodes" | "rankCount" | "laneCount"> {
  const indegree = new Map(definitions.map(({ id }) => [id, 0]));
  const outgoing = new Map(definitions.map(({ id }) => [id, [] as string[]]));
  const rank = new Map(definitions.map(({ id }) => [id, 0]));

  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const queue = definitions
    .filter(({ id }) => indegree.get(id) === 0)
    .map(({ id }) => id);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source || visited.has(source)) continue;
    visited.add(source);
    for (const target of outgoing.get(source) ?? []) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(source) ?? 0) + 1));
      const remaining = (indegree.get(target) ?? 1) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  // Pure cycles have no zero-indegree starting node. Keep their source order
  // visible instead of looping the layout calculation indefinitely.
  let unresolvedRank = 0;
  for (const definition of definitions) {
    if (visited.has(definition.id)) continue;
    rank.set(definition.id, Math.max(rank.get(definition.id) ?? 0, unresolvedRank));
    unresolvedRank += 1;
  }

  const lanesByRank = new Map<number, number>();
  const nodes = definitions.map((definition) => {
    const nodeRank = rank.get(definition.id) ?? 0;
    const lane = lanesByRank.get(nodeRank) ?? 0;
    lanesByRank.set(nodeRank, lane + 1);
    return { ...definition, rank: nodeRank, lane };
  });
  const maxRank = Math.max(0, ...nodes.map((node) => node.rank));
  const maxLanes = Math.max(1, ...lanesByRank.values());
  return { nodes, rankCount: maxRank + 1, laneCount: maxLanes };
}

export function parseFlowchart(source: string): ParsedFlowchart | null {
  const lines = source
    .replace(/\u0000/gu, "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerIndex = lines.findIndex((line) => /^flowchart\s+/iu.test(line));
  if (headerIndex < 0) return null;
  const header = lines[headerIndex].match(/^flowchart\s+(LR|RL|TD|TB)$/iu);
  if (!header) return null;
  const direction = header[1].toUpperCase() as FlowchartDirection;
  const definitions = new Map<string, NodeDefinition>();
  const parsedEdges: Omit<FlowchartEdge, "id">[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    if (
      line.startsWith("%%") ||
      /^subgraph\b/iu.test(line) ||
      /^end$/iu.test(line)
    )
      continue;
    const split = splitEdge(line);
    if (!split) continue;
    const left = parseNode(split.left);
    const right = parseNode(split.right);
    if (!left || !right) return null;
    definitions.set(left.id, {
      ...definitions.get(left.id),
      ...left,
      label:
        left.label === left.id
          ? (definitions.get(left.id)?.label ?? left.label)
          : left.label,
      kind:
        left.label === left.id
          ? (definitions.get(left.id)?.kind ?? left.kind)
          : left.kind,
    });
    definitions.set(right.id, {
      ...definitions.get(right.id),
      ...right,
      label:
        right.label === right.id
          ? (definitions.get(right.id)?.label ?? right.label)
          : right.label,
      kind:
        right.label === right.id
          ? (definitions.get(right.id)?.kind ?? right.kind)
          : right.kind,
    });
    parsedEdges.push({
      source: left.id,
      target: right.id,
      ...(split.label ? { label: split.label } : {}),
      dashed: split.dashed,
    });
  }

  if (definitions.size === 0 || parsedEdges.length === 0) return null;
  const layout = assignLayout([...definitions.values()], parsedEdges);
  return {
    direction,
    ...layout,
    edges: parsedEdges.map((edge, index) => ({
      ...edge,
      id: `edge-${index}-${edge.source}-${edge.target}`,
    })),
  };
}
