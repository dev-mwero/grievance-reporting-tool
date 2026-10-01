"use client";

import { Paperclip, X } from "lucide-react";
import { useState } from "react";
import { UploadDropzone } from "@/components/attachment-dropzone";
import { Alert, Button, Label, Spinner } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";

/** A file the browser has uploaded but which is not yet on a complaint. */
export interface StagedFile {
  fileKey: string;
  name: string;
  size: number;
}

export interface PublicEvidenceUploaderProps {
  /**
   * Keys of the files staged so far, held by the form because they are part of
   * the submission payload. The uploader has no complaint to attach them to until
   * the form is submitted.
   */
  staged: StagedFile[];
  onStagedChange: (files: StagedFile[]) => void;
  /**
   * The capability the form will present on submit.
   *
   * Passed in rather than fetched here so the form and the uploader share one
   * token and one request. It can arrive after the uploader has already mounted,
   * which is why the dropzone is only rendered once it exists.
   */
  capability?: string;
  maxFiles?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Optional evidence upload for the public grievance form.
 *
 * The bytes go straight from the browser to storage; this only collects the keys
 * so the submission can carry them, which is why the form posts JSON rather than
 * multipart form data — the same split the staff panel uses.
 *
 * The security here is a capability rather than a session, because the person
 * filling this in has no account. A short-lived signed id is fetched up front,
 * travels with every upload, and is presented again on submit so the server can
 * tell that the keys belong to this submission.
 */
export function PublicEvidenceUploader({
  staged,
  onStagedChange,
  capability,
  maxFiles = 5,
}: PublicEvidenceUploaderProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const atLimit = staged.length >= maxFiles;

  const handleComplete = (
    uploaded: {
      serverData:
        | { fileKey?: string; name?: string; size?: number }
        | undefined;
    }[],
  ) => {
    const added = uploaded
      .map((u) => u.serverData)
      .filter((d): d is { fileKey: string; name?: string; size?: number } =>
        Boolean(d?.fileKey),
      )
      .map((d) => ({
        fileKey: d.fileKey as string,
        name: d.name ?? "Uploaded file",
        size: d.size ?? 0,
      }));

    if (added.length === 0) return;

    // Guard against a double-callback adding the same key twice, which would
    // otherwise be sent to the server as a duplicate and rejected as a conflict.
    const existing = new Set(staged.map((f) => f.fileKey));
    const fresh = added.filter((f) => !existing.has(f.fileKey));
    if (fresh.length === 0) return;

    onStagedChange([...staged, ...fresh]);
    setUploadError(null);
  };

  const reportError = (message: string) => {
    setUploadError(message);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Supporting evidence (optional)</Label>
        {staged.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {staged.length} of {maxFiles} attached
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Photos or documents that support your complaint — for example a photo of
        the problem, or a letter you received. Optional, and visible only to the
        officers handling your case.
      </p>

      {uploadError && <Alert variant="error">{uploadError}</Alert>}

      {staged.length > 0 && (
        <ul className="space-y-2">
          {staged.map((file) => (
            <li
              key={file.fileKey}
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(file.size)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                // Removing it from the form is not deleting anything: the file
                // stays in storage until the capability's reaper collects it,
                // which is the safe direction to fail in.
                onClick={() =>
                  onStagedChange(
                    staged.filter((f) => f.fileKey !== file.fileKey),
                  )
                }
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove {file.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!capability ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Preparing the uploader…
        </div>
      ) : atLimit ? (
        <p className="text-sm text-muted-foreground">
          That is the maximum number of files. Remove one to attach a different
          file.
        </p>
      ) : (
        <UploadDropzone
          endpoint="publicEvidence"
          // Remounting on the capability is what applies a refreshed token to the
          // dropzone, which otherwise holds its own `input` value internally.
          key={capability}
          input={{ capability }}
          onClientUploadComplete={handleComplete}
          onUploadError={(e) =>
            reportError(apiErrorMessage(e, "Upload failed"))
          }
        />
      )}
    </div>
  );
}
