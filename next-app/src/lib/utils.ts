import { type ClassValue, clsx } from "clsx";
import DOMPurify from "dompurify";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  value: string | Date | undefined | null,
  opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, opts).format(date);
}

export function formatRelative(
  value: string | Date | undefined | null,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return formatter.format(diffSeconds, "second");
  if (abs < 3600)
    return formatter.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400)
    return formatter.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 2592000)
    return formatter.format(Math.round(diffSeconds / 86400), "day");
  return formatDate(date, { dateStyle: "medium" });
}

// ─── Rich text helpers (client) ─────────────────────────────────────────────

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "code",
  "pre",
];

/**
 * Sanitize rich text on the client. During SSR the value returned by the API is
 * already sanitized server-side, so the input is passed through unchanged to
 * avoid importing heavy sanitizers into the server bundle.
 */
export function sanitizeRichText(input: string): string {
  if (typeof window === "undefined") return input;
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/,
  });
}

export function stripHtml(input: string): string {
  if (typeof window !== "undefined") {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
      .replace(/\s+/g, " ")
      .trim();
  }
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
