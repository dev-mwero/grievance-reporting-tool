"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Paperclip, Trash2 } from "lucide-react";
import { useState } from "react";
import { UploadDropzone } from "@/components/attachment-dropzone";
import { Alert, Button } from "@/components/ui";
import { ApiClientError, apiDelete, apiGet, apiPost } from "@/lib/api";

interface Attachment {
  id: string;
  name: string;
  size: number;
  contentType: string;
  uploadedByName: string;
  createdAt: string;
  isImage: boolean;
  url: string;
}

/** Bytes as a short human string, e.g. 1.4 MB. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface AttachmentPanelProps {
  grievanceId: string;
  /** When set, uploads are also claimed as evidence for this proposal. */
  transitionRequestId?: string;
  /**
   * Hide the dropzone because the requirement is already satisfied. Lets a
   * caller with existing evidence avoid offering a second uploader for it.
   */
  hasEvidence?: boolean;
  /** Receives the keys just uploaded so a proposal can claim them. */
  onUploaded?: (fileKeys: string[]) => void;
}

/**
 * A complaint's evidence, with upload and removal.
 *
 * File bytes go straight from the browser to storage; this component only
 * records the claim afterwards, which is why it holds file keys instead of
 * sending multipart form data to the app. The list is refetched rather than
 * patched locally because every entry carries a freshly signed URL — the ones
 * handed out on the previous fetch are already expiring.
 */
export function AttachmentPanel({
  grievanceId,
  transitionRequestId,
  hasEvidence = false,
  onUploaded,
}: AttachmentPanelProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);

  const queryKey = ["/grievances", grievanceId, "attachments"];

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey,
    queryFn: ({ signal }) =>
      apiGet<Attachment[]>(`/grievances/${grievanceId}/attachments`, signal),
    enabled: Boolean(grievanceId),
  });

  const claimMutation = useMutation({
    mutationFn: (fileKeys: string[]) =>
      apiPost(`/grievances/${grievanceId}/attachments`, {
        fileKeys,
        ...(transitionRequestId ? { transitionRequestId } : {}),
      }),
    onError: (err) =>
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not attach those files.",
      ),
  });

  const removeMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      apiDelete(`/attachments/${attachmentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) =>
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not remove that file.",
      ),
  });

  /**
   * Claim freshly uploaded files.
   *
   * Runs after the dropzone reports success. A failure here leaves the file in
   * storage but not linked to the complaint, so it is surfaced rather than
   * swallowed: the user needs to know to retry, not to assume it worked.
   */
  const handleUploadComplete = (
    uploaded: {
      serverData: { fileKey?: string } | undefined;
    }[],
  ) => {
    const keys = uploaded
      .map((u) => u.serverData?.fileKey)
      .filter((k): k is string => Boolean(k));
    if (keys.length === 0) return;

    claimMutation.mutate(keys, {
      onSuccess: () => {
        setError(null);
        setJustUploaded(true);
        onUploaded?.(keys);
        queryClient.invalidateQueries({ queryKey });
      },
    });
  };

  // Offer the uploader while the requirement is unmet, or while there is a
  // freshly uploaded file still mid-claim — hiding it on `hasEvidence` alone
  // would hide it during the window a claim is in flight.
  const showUploader = hasEvidence ? justUploaded : true;

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading evidence…</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No evidence attached.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={a.name}>
                {a.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(a.size)}
              </span>
              {/* The URL is signed and short-lived. `noopener noreferrer` stops
                  it leaking via the Referer header and keeps the opened page
                  from reaching back through window.opener. */}
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                title={`Open ${a.name}`}
              >
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">Open {a.name}</span>
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeMutation.mutate(a.id)}
                disabled={removeMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove {a.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showUploader && (
        <UploadDropzone
          endpoint="evidence"
          onClientUploadComplete={handleUploadComplete}
          onUploadError={(e) => setError(e.message)}
        />
      )}
    </div>
  );
}
