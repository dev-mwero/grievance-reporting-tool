"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditDialog } from "@/components/edit-dialog";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
} from "@/components/ui";
import {
  Background,
  Controls,
  type Edge,
  layoutStages,
  MarkerType,
  MiniMap,
  edgeTypes as MOVE_EDGE_TYPES,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  nodeTypes as STAGE_NODE_TYPES,
  stageDepths,
  useEdgesState,
  useNodesState,
} from "@/components/workflow-canvas";
import { apiErrorMessage, apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  availableTransitions,
  type GraphTransition,
  type ValidationIssue,
} from "@/server/services/workflow-graph";
import { Role } from "@/types";

interface WorkflowDetail {
  _id: string;
  name: string;
  description?: string;
  isGlobal: boolean;
  isActive: boolean;
  categoryId?: { _id: string; name: string } | null;
  startStageKey: string;
  stages: {
    key: string;
    label: string;
    description?: string;
    isFinal: boolean;
    color?: string;
    order: number;
    position?: { x: number; y: number };
  }[];
  transitions: {
    from: string;
    to: string;
    actionLabel: string;
    allowedRoles: string[];
    requiresApproval: boolean;
    requiresReason: boolean;
    requiresAttachment: boolean;
  }[];
}

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export default function WorkflowBuilderPage() {
  const params = useParams<{ id: string }>();
  return (
    <ReactFlowProvider>
      <Builder id={params.id} />
    </ReactFlowProvider>
  );
}

function Builder({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [editingStage, setEditingStage] = useState<
    WorkflowDetail["stages"][number] | null
  >(null);
  const [editingMove, setEditingMove] = useState<GraphTransition | null>(null);
  const [stageForm, setStageForm] = useState({ label: "", isFinal: false });
  const [moveForm, setMoveForm] = useState({
    actionLabel: "",
    allowedRoles: [Role.STAFF] as string[],
    requiresApproval: false,
    requiresReason: false,
    requiresAttachment: false,
  });

  const { data, isLoading } = useQuery<WorkflowDetail>({
    queryKey: ["/admin/workflows", { id }],
    queryFn: ({ signal }) =>
      apiGet<WorkflowDetail>(`/admin/workflows/${id}`, signal),
  });

  const workflow = data;

  const showErr = (err: unknown) => setError(apiErrorMessage(err));

  const validate = useMutation({
    mutationFn: () =>
      apiGet<{ valid: boolean; issues: ValidationIssue[] }>(
        `/admin/workflows/${id}/validate`,
      ),
    onError: showErr,
  });
  const issues = validate.data?.issues ?? [];

  // ReactFlow owns the node state so boxes can actually be dragged. The
  // `syncFrom` effect re-seeds it whenever the workflow itself changes, and
  // `onNodeDragStop` writes the final positions back.
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const stages = workflow?.stages;
  const transitions = workflow?.transitions;
  const startStageKey = workflow?.startStageKey;
  const issueKeys = useMemo(
    () =>
      new Set(
        issues.map((i) => i.stageKey).filter((k): k is string => Boolean(k)),
      ),
    [issues],
  );

  useEffect(() => {
    if (!stages) return;
    // Prefer the admin's stored layout; fall back to the automatic lanes for any
    // stage that has never been dragged.
    const automatic = layoutStages(
      stages.map((s) => s.key),
      (key) =>
        Math.max(
          stageDepths(startStageKey ?? "", transitions ?? [])[key] ?? 0,
          0,
        ),
    );

    setNodes(
      stages.map((stage) => ({
        id: stage.key,
        type: "stage",
        position: stage.position ?? automatic[stage.key] ?? { x: 0, y: 0 },
        data: {
          label: stage.label,
          isFinal: stage.isFinal,
          isStart: stage.key === startStageKey,
          hasIssues: issueKeys.has(stage.key),
        },
      })),
    );

    setEdges(
      (transitions ?? []).map((t) => ({
        id: `${t.from}__${t.to}`,
        source: t.from,
        target: t.to,
        type: "move",
        markerEnd: { type: MarkerType.ArrowClosed },
        data: {
          actionLabel: t.actionLabel,
          requiresApproval: t.requiresApproval,
          requiresReason: t.requiresReason,
        },
      })),
    );
  }, [stages, transitions, startStageKey, issueKeys, setNodes, setEdges]);

  const save = useMutation({
    mutationFn: (payload: {
      stages?: WorkflowDetail["stages"];
      transitions?: WorkflowDetail["transitions"];
      startStageKey?: string;
    }) => apiPatch(`/admin/workflows/${id}`, payload),
    onSuccess: () => {
      setSaveError(null);
      setMessage("Saved.");
      queryClient.invalidateQueries({ queryKey: ["/admin/workflows"] });
      // Re-derive the issues from the newly saved graph.
      validate.mutate();
    },
    onError: (err) => setSaveError(apiErrorMessage(err)),
  });

  const addStage = useMutation({
    mutationFn: async () => {
      if (!workflow) return;
      const label = `Stage ${workflow.stages.length + 1}`;
      await apiPatch(`/admin/workflows/${id}`, {
        stages: [
          ...workflow.stages,
          {
            key: slug(label) || `stage_${workflow.stages.length + 1}`,
            label,
            isFinal: false,
            order: workflow.stages.length,
          },
        ],
      });
    },
    onSuccess: () => {
      setMessage("Stage added.");
      queryClient.invalidateQueries({ queryKey: ["/admin/workflows"] });
    },
    onError: (err) => setSaveError(apiErrorMessage(err)),
  });

  const activate = useMutation({
    mutationFn: () => apiPost(`/admin/workflows/${id}/activate`),
    onSuccess: () => {
      setMessage("Workflow activated.");
      queryClient.invalidateQueries({ queryKey: ["/admin/workflows"] });
    },
    onError: showErr,
  });

  const deactivate = useMutation({
    mutationFn: () => apiPost(`/admin/workflows/${id}/deactivate`),
    onSuccess: () => {
      setMessage("Workflow deactivated.");
      queryClient.invalidateQueries({ queryKey: ["/admin/workflows"] });
    },
    onError: showErr,
  });

  // Persist the layout when a drag ends, rather than on every pixel of movement.
  // Positions are presentation only, so a lost drag costs nothing but tidiness.
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      if (!workflow) return;
      save.mutate({
        stages: workflow.stages.map((stage) =>
          stage.key === node.id
            ? { ...stage, position: { x: node.position.x, y: node.position.y } }
            : stage,
        ),
      });
    },
    // `save` is stable across renders; `workflow` must be current so the stage
    // list sent back is the one the drag happened against.
    [workflow, save],
  );

  if (isLoading || !workflow) {
    return <Spinner className="mx-auto h-8 w-8" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              All workflows
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {workflow.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {workflow.isGlobal
                ? "Global cycle — used by every complaint without its own."
                : `Applies to ${workflow.categoryId?.name ?? "one category"}, overriding the global cycle.`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => addStage.mutate()}
            disabled={save.isPending}
          >
            <Plus className="h-4 w-4" />
            Add stage
          </Button>
          <Button size="sm" variant="outline" onClick={() => validate.mutate()}>
            Check workflow
          </Button>
          {workflow.isActive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => activate.mutate()}
              disabled={activate.isPending || issues.length > 0}
              title={
                issues.length > 0
                  ? "Fix the reported problems before activating"
                  : undefined
              }
            >
              Activate
            </Button>
          )}
        </div>
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      {saveError && <Alert variant="error">{saveError}</Alert>}

      {issues.length > 0 && (
        <Alert variant="error">
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.map((issue, i) => (
              <li key={`${issue.code}-${i}`}>{issue.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardContent className="p-0">
            <div className="h-[32rem]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onNodeDragStop={onNodeDragStop}
                onEdgesChange={onEdgesChange}
                nodeTypes={STAGE_NODE_TYPES}
                edgeTypes={MOVE_EDGE_TYPES}
                onNodeDoubleClick={(_, node) => {
                  const stage = workflow.stages.find((s) => s.key === node.id);
                  if (!stage) return;
                  setStageForm({ label: stage.label, isFinal: stage.isFinal });
                  setEditingStage(stage);
                }}
                onEdgeDoubleClick={(_, edge) => {
                  const move = workflow.transitions.find(
                    (t) => `${t.from}__${t.to}` === edge.id,
                  );
                  if (!move) return;
                  setMoveForm({
                    actionLabel: move.actionLabel,
                    allowedRoles: move.allowedRoles,
                    requiresApproval: move.requiresApproval,
                    requiresReason: move.requiresReason,
                    requiresAttachment: move.requiresAttachment,
                  });
                  setEditingMove(move);
                }}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background />
                <Controls />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Stages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {workflow.stages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add a stage to begin.
                </p>
              )}
              {workflow.stages.map((stage) => (
                <div
                  key={stage.key}
                  className="rounded-lg border p-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{stage.label}</span>
                    <div className="flex items-center gap-1">
                      {stage.key !== workflow.startStageKey && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Make this the start stage"
                          onClick={() =>
                            save.mutate({ startStageKey: stage.key })
                          }
                        >
                          Start
                        </Button>
                      )}
                      {stage.key === workflow.startStageKey && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                          Start
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Remove this stage"
                        disabled={save.isPending || workflow.stages.length <= 1}
                        onClick={() => removeStage(stage.key, save, workflow)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {stage.isFinal && (
                    <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Final
                    </span>
                  )}
                  <div className="mt-1.5 flex gap-1.5">
                    {availableTransitions(
                      {
                        stages: workflow.stages,
                        transitions: workflow.transitions,
                        startStageKey: workflow.startStageKey,
                      },
                      stage.key,
                      Role.ADMIN,
                    ).map((t) => (
                      <Button
                        key={`${t.from}__${t.to}`}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setMoveForm({
                            actionLabel: t.actionLabel,
                            allowedRoles: t.allowedRoles,
                            requiresApproval: t.requiresApproval,
                            requiresReason: t.requiresReason,
                            requiresAttachment: t.requiresAttachment,
                          });
                          setEditingMove(t);
                        }}
                      >
                        {t.actionLabel} → {stageLabel(workflow, t.to)}
                      </Button>
                    ))}
                    <AddMoveButton
                      workflow={workflow}
                      fromKey={stage.key}
                      onPick={(to) => {
                        const label = `Move to ${stageLabel(workflow, to)}`;
                        setMoveForm({
                          actionLabel: label,
                          allowedRoles: [Role.STAFF],
                          requiresApproval: false,
                          requiresReason: false,
                          requiresAttachment: false,
                        });
                        setEditingMove({
                          from: stage.key,
                          to,
                          actionLabel: label,
                          allowedRoles: [Role.STAFF],
                          requiresApproval: false,
                          requiresReason: false,
                          requiresAttachment: false,
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stage rename / final toggle */}
      <EditDialog
        open={Boolean(editingStage)}
        onClose={() => setEditingStage(null)}
        title="Edit stage"
        description={editingStage?.key}
        onSubmit={() => {
          if (!editingStage) return;
          save.mutate({
            stages: workflow.stages.map((s) =>
              s.key === editingStage.key
                ? { ...s, label: stageForm.label, isFinal: stageForm.isFinal }
                : s,
            ),
          });
          setEditingStage(null);
        }}
        saving={save.isPending}
        error={saveError}
      >
        <div>
          <Label htmlFor="stage-label">Stage name</Label>
          <Input
            id="stage-label"
            value={stageForm.label}
            onChange={(e) =>
              setStageForm({ ...stageForm, label: e.target.value })
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Renaming is safe — complaints keep pointing at the same stage.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={stageForm.isFinal}
            onChange={(e) =>
              setStageForm({ ...stageForm, isFinal: e.target.checked })
            }
          />
          This stage ends the complaint
        </label>
      </EditDialog>

      {/* Move rules */}
      <EditDialog
        open={Boolean(editingMove)}
        onClose={() => setEditingMove(null)}
        title="Edit move"
        description={
          editingMove
            ? `${stageLabel(workflow, editingMove.from)} → ${stageLabel(workflow, editingMove.to)}`
            : undefined
        }
        onSubmit={() => {
          if (!editingMove) return;
          const next = workflow.transitions.filter(
            (t) => !(t.from === editingMove.from && t.to === editingMove.to),
          );
          save.mutate({
            transitions: [
              ...next,
              {
                from: editingMove.from,
                to: editingMove.to,
                ...moveForm,
              },
            ],
          });
          setEditingMove(null);
        }}
        saving={save.isPending}
        error={saveError}
      >
        <div>
          <Label htmlFor="move-label">Action label</Label>
          <Input
            id="move-label"
            value={moveForm.actionLabel}
            onChange={(e) =>
              setMoveForm({ ...moveForm, actionLabel: e.target.value })
            }
            placeholder="e.g. Escalate"
          />
        </div>
        <div>
          <Label htmlFor="move-roles">Who may take this move</Label>
          <div id="move-roles" className="flex flex-wrap gap-3 text-sm">
            {Object.values(Role).map((role) => (
              <label key={role} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={moveForm.allowedRoles.includes(role)}
                  onChange={(e) =>
                    setMoveForm({
                      ...moveForm,
                      allowedRoles: e.target.checked
                        ? [...moveForm.allowedRoles, role]
                        : moveForm.allowedRoles.filter((r) => r !== role),
                    })
                  }
                />
                {role.replace("_", " ")}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Admins can always take any move, whichever boxes are ticked.
          </p>
        </div>
        <div className="space-y-2">
          <Toggle
            checked={moveForm.requiresApproval}
            onChange={(v) => setMoveForm({ ...moveForm, requiresApproval: v })}
            label="Needs admin approval"
            hint="Staff propose the move; it waits until an admin approves it."
          />
          <Toggle
            checked={moveForm.requiresReason}
            onChange={(v) => setMoveForm({ ...moveForm, requiresReason: v })}
            label="Requires a reason"
            hint="A written reason is stored with the move."
          />
          <Toggle
            checked={moveForm.requiresAttachment}
            onChange={(v) =>
              setMoveForm({ ...moveForm, requiresAttachment: v })
            }
            label="Requires an attachment"
            hint="Supporting evidence must be attached."
          />
        </div>
      </EditDialog>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function AddMoveButton({
  workflow,
  fromKey,
  onPick,
}: {
  workflow: WorkflowDetail;
  fromKey: string;
  onPick: (to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const existing = new Set(
    workflow.transitions.filter((t) => t.from === fromKey).map((t) => t.to),
  );
  const targets = workflow.stages.filter(
    (s) => s.key !== fromKey && !existing.has(s.key),
  );

  if (targets.length === 0) return null;

  return (
    <span className="relative">
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-3 w-3" />
        Move to…
      </Button>
      {open && (
        <span className="absolute z-20 mt-1 flex flex-col gap-1 rounded-lg border bg-card p-1 shadow-lg">
          {targets.map((s) => (
            <button
              key={s.key}
              type="button"
              className="rounded px-2 py-1 text-left text-xs hover:bg-muted"
              onClick={() => {
                onPick(s.key);
                setOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function stageLabel(workflow: WorkflowDetail, key: string): string {
  return workflow.stages.find((s) => s.key === key)?.label ?? key;
}

/**
 * Remove a stage along with every move touching it. Leaving orphaned moves
 * behind would fail the workflow's own validation and block activation.
 */
function removeStage(
  key: string,
  save: {
    mutate: (payload: {
      stages?: WorkflowDetail["stages"];
      transitions?: WorkflowDetail["transitions"];
      startStageKey?: string;
    }) => void;
  },
  workflow: WorkflowDetail,
) {
  const stages = workflow.stages.filter((s) => s.key !== key);
  const transitions = workflow.transitions.filter(
    (t) => t.from !== key && t.to !== key,
  );
  save.mutate({
    stages: stages.map((s, index) => ({ ...s, order: index })),
    transitions,
    ...(workflow.startStageKey === key && stages[0]
      ? { startStageKey: stages[0].key }
      : {}),
  });
}
