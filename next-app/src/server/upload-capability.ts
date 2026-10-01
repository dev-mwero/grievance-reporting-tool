import crypto from "node:crypto";
import { env } from "./env";

/**
 * How long a public upload capability stays usable.
 *
 * Long enough that someone can pick files off their phone, write a description,
 * attach it to a different document, and attach that to the form; short enough
 * that a capability left in a shared machine's memory is not a standing licence
 * to spend storage later. The reaper uses the same window as its expiry, so an
 * unclaimed upload cannot outlive its claim by more than this.
 */
const CAPABILITY_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * The same window, for callers that need to date an upload rather than verify
 * one.
 *
 * The sweeper deletes a stored file at its `expiresAt`, so if this were set
 * independently and drifted below the capability lifetime, a slow but entirely
 * valid submitter would lose evidence they were still entitled to claim. It is
 * exported precisely so there is only one number to get wrong.
 */
export const UPLOAD_CAPABILITY_TTL_MS = CAPABILITY_TTL_MS;

/**
 * A bearer capability for anonymous evidence uploads.
 *
 * The public form has no account, so there is no user id to bind an upload to.
 * What it can have instead is an id only the app can vouch for: the capability
 * is `submissionId.signature`, and a PendingUpload row is stamped with the
 * `submissionId` half. Claiming later requires presenting the matching
 * capability, so a file key on its own proves nothing — it must be joined by a
 * signature over the very id the row was written with.
 *
 * This is what keeps the ledger's guarantee intact for anonymous uploads. The
 * staff flow can compare `uploadedBy` against the caller's user id; here the
 * comparison is against an unforgeable id the app issued, so one complainant
 * still cannot attach another's evidence by learning a file key from a log, a
 * Referer header, or a screenshot of the network tab.
 */
export interface UploadCapability {
  submissionId: string;
  /** Epoch millis after which this capability must be rejected. */
  expiresAt: number;
}

/**
 * The id is `<issued-at:12 hex><random:20 hex>`.
 *
 * The timestamp leads so that expiry needs no extra storage and cannot be
 * extended by editing the token: the signature covers the whole id, and the age
 * is read straight back out of it. That leaves 80 bits of randomness, which is
 * ample for a value whose security rests on being unguessable rather than
 * unique — two ids colliding would be a correctness bug, not a security one, and
 * a 48-bit timestamp makes that remote enough to ignore.
 */
const SUBMISSION_ID_PATTERN = /^[a-f0-9]{32}$/;
const TIMESTAMP_HEX_LENGTH = 12;

/** Mint a capability for a fresh anonymous submission. */
export function issueUploadCapability(): UploadCapability {
  const issuedAt = Date.now();
  const submissionId = `${issuedAt.toString(16).padStart(TIMESTAMP_HEX_LENGTH, "0")}${crypto.randomBytes(10).toString("hex")}`;
  return { submissionId, expiresAt: issuedAt + CAPABILITY_TTL_MS };
}

/** Serialise a capability for the client to pass to the upload route. */
export function serializeUploadCapability(cap: UploadCapability): string {
  return `${cap.submissionId}.${signSubmissionId(cap.submissionId)}`;
}

function signSubmissionId(submissionId: string): string {
  return crypto
    .createHmac("sha256", env.UPLOAD_CAPABILITY_SECRET)
    .update(submissionId)
    .digest("base64url");
}

/**
 * Verify a capability and return the submission id it authorises.
 *
 * Yields null rather than throwing for every failure — a missing, malformed,
 * forged, or expired capability is a request to reject, not an error to raise
 * through a route handler. Callers must treat null as "not authorised" and never
 * fall back to a weaker check.
 */
export function verifyUploadCapability(
  token: string | undefined,
): UploadCapability | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const submissionId = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  // Reject the shape before hashing. A hostile multi-megabyte string should not
  // reach the HMAC, and anything that is not a well-formed id cannot be one we
  // issued.
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) return null;
  if (!signature.length || signature.length > 128) return null;

  const expected = signSubmissionId(submissionId);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return null;
  }

  // The signature is now known good, so this id really was minted here. A
  // timestamp outside any plausible window means the id was not built the way
  // the issuer builds them, and is rejected rather than trusted.
  const issuedAt = Number.parseInt(
    submissionId.slice(0, TIMESTAMP_HEX_LENGTH),
    16,
  );
  if (!Number.isFinite(issuedAt)) return null;

  const now = Date.now();
  // The forward slack absorbs clock skew between the process that minted the
  // token and the one checking it; the backward bound is the real expiry, kept
  // deliberately wider than the TTL so a token stays valid for its full life
  // even if the TTL is retuned upwards.
  if (issuedAt > now + 60_000) return null;
  if (now - issuedAt >= CAPABILITY_TTL_MS) return null;

  return { submissionId, expiresAt: issuedAt + CAPABILITY_TTL_MS };
}
