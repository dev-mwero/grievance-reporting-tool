"use client";

import type { ReactNode } from "react";
import { Alert, Button, Modal } from "@/components/ui";

/**
 * Modal wrapper for editing a single record.
 *
 * Every admin table needs the same shape — a titled dialog, a body of fields,
 * and a Cancel/Save footer wired to one mutation — so that plumbing lives here
 * instead of being copied into each page.
 */
export function EditDialog({
  open,
  onClose,
  title,
  description,
  size,
  onSubmit,
  saving,
  error,
  submitLabel = "Save changes",
  children,
}: {
  open: boolean;
  /** Dismiss without saving. Callers should ignore this while saving. */
  onClose: () => void;
  title: string;
  /** Context line under the title, e.g. the record being edited. */
  description?: ReactNode;
  size?: "sm" | "md" | "lg";
  onSubmit: () => void;
  saving?: boolean;
  error?: string | null;
  submitLabel?: string;
  children: ReactNode;
}) {
  const locked = Boolean(saving);

  return (
    <Modal
      open={open}
      // Losing the dialog mid-request would leave the admin unsure whether the
      // change was applied, so a pending save swallows the close.
      onClose={() => {
        if (!saving) onClose();
      }}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            type="button"
          >
            Cancel
          </Button>
          {/*
            The footer is visually inside the dialog but not a descendant of
            <form>, so this button cannot carry the form's submit behaviour.
            Clicking calls onSubmit directly, and Enter inside the form goes
            through the hidden submit below.
          */}
          <Button onClick={onSubmit} disabled={locked} type="button">
            {saving ? "Saving…" : submitLabel}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {error && <Alert variant="error">{error}</Alert>}
        {children}
        {/* Lets Enter submit from any single-line field inside the dialog. */}
        <button
          type="submit"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </form>
    </Modal>
  );
}
