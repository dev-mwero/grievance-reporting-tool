"use client";

import { sanitizeRichText } from "@/lib/utils";

export function RichTextView({ html }: { html: string }) {
  if (!html) return <span className="text-muted-foreground">No content</span>;
  return (
    <div
      className="prose prose-sm prose-primary max-w-none prose-headings:font-semibold"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized via DOMPurify in sanitizeRichText
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}
