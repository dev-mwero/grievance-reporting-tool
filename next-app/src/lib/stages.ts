/**
 * Stage naming helpers shared by server and client.
 *
 * Deliberately dependency-free: this is imported by client components, so it
 * must not pull in mongoose or anything else that only exists on the server.
 * Anything here has to be safe to ship to a browser.
 */

export interface StageDescriptor {
  key: string;
  label: string;
  color?: string;
  isFinal: boolean;
  order: number;
}

/**
 * A human-readable name for a stage key, used when no workflow supplies one.
 *
 * Legacy complaints were submitted before any workflow was pinned to them, so a
 * key may legitimately have no owner — an admin may also have deleted the stage
 * since. Rendering the raw key is plain, but it keeps the complaint
 * identifiable, which matters more than prettiness on a screen someone uses to
 * find their case.
 */
export function humanizeStageKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Where a complaint sits, resolved from its workflow. */
export function stageFor(
  status: string,
  labels: Map<string, StageDescriptor> | undefined,
): StageDescriptor {
  return (
    labels?.get(status) ?? {
      key: status,
      label: humanizeStageKey(status),
      isFinal: false,
      order: 0,
    }
  );
}
