"use client";

import { useMutation } from "@tanstack/react-query";
import { RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button, Select } from "@/components/ui";
import { apiDelete, apiErrorMessage, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/** Which slice of a soft-deletable collection the admin table is showing. */
export type DeletionScope = "active" | "deleted" | "all";

const SCOPE_LABELS: Record<DeletionScope, string> = {
  active: "Active only",
  deleted: "Deleted only",
  all: "Active + deleted",
};

/** Switch a table between live records, the deleted tray, and both. */
export function DeletionScopeSelect({
  value,
  onChange,
  className,
}: {
  value: DeletionScope;
  onChange: (scope: DeletionScope) => void;
  className?: string;
}) {
  return (
    <Select
      value={value}
      aria-label="Record visibility"
      onChange={(e) => onChange(e.target.value as DeletionScope)}
      className={cn("w-44", className)}
    >
      {(Object.keys(SCOPE_LABELS) as DeletionScope[]).map((scope) => (
        <option key={scope} value={scope}>
          {SCOPE_LABELS[scope]}
        </option>
      ))}
    </Select>
  );
}

/**
 * Per-row delete / restore / permanently-delete controls, wired to the three
 * endpoints every admin-managed entity exposes.
 *
 * Soft delete is a single reversible click. Permanent deletion is irreversible,
 * so it is restricted to system admins and gated behind an explicit second
 * click in place of a modal — the confirmation has to be hard to hit by
 * accident but not so heavy that it becomes a habit.
 */
export function DeleteRowActions({
  basePath,
  id,
  label,
  deleted,
  disabled = false,
  disabledReason,
  onDone,
  onError,
  onMessage,
}: {
  /** Collection route without the id, e.g. `/admin/categories`. */
  basePath: string;
  id: string;
  /** Human name of the record, used in the purge confirmation. */
  label: string;
  /** Whether the row is currently soft deleted. */
  deleted: boolean;
  /** Hide the delete action, e.g. on your own account or a locked record. */
  disabled?: boolean;
  /** Why the delete action is unavailable, shown as the button tooltip. */
  disabledReason?: string;
  onDone: () => void;
  onError: (message: string) => void;
  onMessage?: (message: string) => void;
}) {
  const { user } = useAuth();
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const canPurge = user?.role === "SUPER_ADMIN";

  const softDelete = useMutation({
    mutationFn: () => apiDelete(`${basePath}/${id}`),
    onSuccess: () => {
      onMessage?.(`${label} moved to deleted.`);
      onDone();
    },
    onError: (e) => onError(apiErrorMessage(e)),
  });

  const restore = useMutation({
    mutationFn: () => apiPost(`${basePath}/${id}/restore`),
    onSuccess: () => {
      onMessage?.(`${label} restored.`);
      onDone();
    },
    onError: (e) => onError(apiErrorMessage(e)),
  });

  const purge = useMutation({
    mutationFn: () => apiDelete(`${basePath}/${id}/purge`),
    onSuccess: () => {
      setConfirmingPurge(false);
      onMessage?.(`${label} permanently deleted.`);
      onDone();
    },
    onError: (e) => onError(apiErrorMessage(e)),
  });

  const busy = softDelete.isPending || restore.isPending || purge.isPending;

  if (confirmingPurge) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
          <TriangleAlert className="h-3.5 w-3.5" />
          Delete {label} forever?
        </span>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => purge.mutate()}
        >
          {purge.isPending ? "Deleting…" : "Confirm"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setConfirmingPurge(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {deleted ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            title={`Restore ${label}`}
            disabled={busy}
            onClick={() => restore.mutate()}
          >
            <RotateCcw className="h-4 w-4 text-emerald-600" />
          </Button>
          {canPurge && (
            <Button
              variant="ghost"
              size="sm"
              title={`Permanently delete ${label}`}
              disabled={busy}
              onClick={() => setConfirmingPurge(true)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          title={
            disabled
              ? (disabledReason ?? `Cannot delete ${label}`)
              : `Delete ${label}`
          }
          disabled={busy || disabled}
          onClick={() => softDelete.mutate()}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
