import sanitizeHtml from "sanitize-html";

export const ALLOWED_HTML_TAGS = [
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

export const ALLOWED_HTML_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "target", "rel"],
};

/** Server-side rich text sanitization, applied on save. */
export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_HTML_TAGS,
    allowedAttributes: ALLOWED_HTML_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });
}

/** Strip all HTML tags and decode entities for plain-text previews/exports. */
export function stripHtml(input: string): string {
  const text = sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
  return text.replace(/\s+/g, " ").trim();
}
