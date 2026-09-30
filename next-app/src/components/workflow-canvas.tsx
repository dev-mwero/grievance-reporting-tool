"use client";

import {
  applyEdgeChanges,
  Background,
  Controls,
  type Edge,
  type EdgeChange,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface StageNodeData extends Record<string, unknown> {
  label: string;
  isFinal: boolean;
  isStart: boolean;
  hasIssues: boolean;
}

export interface MoveEdgeData extends Record<string, unknown> {
  actionLabel: string;
  requiresApproval: boolean;
  requiresReason: boolean;
}

/**
 * A stage on the canvas. `onEdit` fires on double-click and is wired to
 * `onNodeDoubleClick`, which `useReactFlow` only exposes from inside the
 * provider — hence the component split.
 */
function StageNode({ data, selected }: NodeProps) {
  const { label, isFinal, isStart, hasIssues } = data as StageNodeData;
  return (
    <div
      className={[
        "min-w-40 rounded-lg border-2 bg-card px-4 py-2.5 shadow-sm transition",
        selected ? "border-primary ring-2 ring-primary/25" : "border-border",
        isStart && !selected ? "border-emerald-500" : "",
        hasIssues ? "border-destructive" : "",
      ].join(" ")}
    >
      {!isFinal && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5"
        />
      )}
      <div className="flex items-center gap-1.5">
        {isStart && (
          <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            Start
          </span>
        )}
        {isFinal && (
          <span className="rounded bg-slate-200 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
            Final
          </span>
        )}
      </div>
      <div className="mt-0.5 text-sm font-semibold leading-tight">{label}</div>
      {hasIssues && (
        <div className="mt-1 text-[10px] font-medium text-destructive">
          Check this stage
        </div>
      )}
      {/* No outgoing handle on a final stage: a final stage ends the
          complaint, so offering a way out would contradict the flag. */}
      {!isFinal && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5"
        />
      )}
    </div>
  );
}

function MoveEdgeLabel({ data }: { data?: MoveEdgeData }) {
  const d = data as MoveEdgeData | undefined;
  if (!d) return null;
  return (
    <div className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] leading-tight shadow-sm">
      <span className="font-medium">{d.actionLabel}</span>
      {d.requiresApproval && (
        <span className="ml-1 text-amber-600">· approval</span>
      )}
      {d.requiresReason && (
        <span className="ml-1 text-slate-500">· reason</span>
      )}
    </div>
  );
}

export const nodeTypes = { stage: StageNode };
export const edgeTypes = { move: MoveEdgeLabel };

export {
  Background,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  applyEdgeChanges,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
};

/**
 * Automatic lane layout. Deliberately positional rather than force-directed: an
 * admin reading a cycle wants a predictable left-to-right flow, and a physics
 * simulation would rearrange itself on every drag.
 *
 * Stages are laid out in columns by how far they are from the start, so
 * branches at the same depth stack vertically instead of overlapping.
 */
export function layoutStages(
  keys: string[],
  depthOf: (key: string) => number,
): Record<string, { x: number; y: number }> {
  const byDepth = new Map<number, string[]>();
  for (const key of keys) {
    const depth = depthOf(key);
    const column = byDepth.get(depth) ?? [];
    column.push(key);
    byDepth.set(depth, column);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const COLUMN_GAP = 260;
  const ROW_GAP = 110;

  for (const [depth, column] of byDepth) {
    column.forEach((key, index) => {
      positions[key] = {
        x: depth * COLUMN_GAP,
        // Centred on the column so a branch of three lines up with its parent.
        y: index * ROW_GAP - ((column.length - 1) * ROW_GAP) / 2,
      };
    });
  }
  return positions;
}

/** Breadth-first distance in moves from the start stage; unreachable = -1. */
export function stageDepths(
  startKey: string,
  transitions: { from: string; to: string }[],
): Record<string, number> {
  const depth: Record<string, number> = { [startKey]: 0 };
  const queue = [startKey];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const t of transitions) {
      if (t.from !== current) continue;
      if (depth[t.to] !== undefined) continue;
      depth[t.to] = depth[current] + 1;
      queue.push(t.to);
    }
  }
  return depth;
}
