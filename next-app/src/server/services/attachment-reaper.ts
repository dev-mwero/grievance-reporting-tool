import { UTApi } from "uploadthing/server";
import { PendingUpload } from "../models/attachment-upload.model";

const utapi = new UTApi();

/**
 * How often a sweep may actually run.
 *
 * The reaper is opportunistic — it piggybacks on traffic rather than running on a
 * schedule, because the app has no cron. That only stays affordable if a busy
 * period does not turn into a sweep per request, so the interval is enforced here
 * in module scope. It is deliberately not a lock: two concurrent callers may both
 * decide to sweep, which costs one redundant delete attempt and is a far better
 * trade than a lock that can wedge a request.
 */
const MIN_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** One batch is enough; anything more belongs to the next sweep. */
const SWEEP_BATCH_SIZE = 100;

let lastSweepAt = 0;

/**
 * Delete anonymous uploads that were never claimed, once their capability has
 * expired.
 *
 * A staff upload is skipped entirely: it belongs to a real person who may still
 * be writing the description they intend to attach it to, and an account gives an
 * operator something to reason about. An anonymous upload leaves nothing behind
 * if it is abandoned, so without this the public form is a way to write to
 * storage and walk away — a per-IP rate limit bounds the rate, not the total.
 *
 * Both halves of the delete are needed, and the order is the same as in
 * `removeAttachment`: the row goes first, so a storage failure leaves an
 * unreferenced file rather than a row the app keeps offering.
 */
export async function reapExpiredPublicUploads(): Promise<number> {
  const now = Date.now();
  if (now - lastSweepAt < MIN_SWEEP_INTERVAL_MS) return 0;
  lastSweepAt = now;

  let expired: Array<{ _id: unknown; fileKey: string }>;
  try {
    expired = await PendingUpload.find({
      expiresAt: { $lte: new Date(now) },
      claimedAt: { $exists: false },
    })
      .select("fileKey")
      .limit(SWEEP_BATCH_SIZE)
      .lean();
  } catch {
    // A sweep is housekeeping. Failing to look is not a reason to fail the
    // submission that happened to trigger it.
    return 0;
  }

  if (expired.length === 0) return 0;

  // Claim the rows first, so a request that is mid-claim cannot have its
  // attachment deleted underneath it. The window is tiny but real, and a file
  // that is claimed and then swept would be evidence that vanished.
  const ids = expired.map((row) => row._id);
  const claimed = await PendingUpload.find({
    _id: { $in: ids },
    claimedAt: { $exists: false },
  })
    .select("fileKey")
    .lean();

  if (claimed.length === 0) return 0;

  await PendingUpload.deleteMany({ _id: { $in: claimed.map((r) => r._id) } });

  try {
    await utapi.deleteFiles(claimed.map((row) => row.fileKey));
  } catch {
    // The records are gone, so the app will never offer these files again. What
    // remains in storage is a cost, not a correctness problem, and retrying
    // blindly would risk deleting a key a future upload reused.
    console.warn(
      `[REAP] removed ${claimed.length} expired upload record(s) but could not delete the files from storage`,
    );
  }

  return claimed.length;
}
