import mongoose from "mongoose";
import { UTApi } from "uploadthing/server";
import { Role } from "@/types";
import { ApiError } from "../api-error";
import {
  ALLOWED_CONTENT_TYPES,
  Attachment,
  type IAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_GRIEVANCE,
} from "../models/attachment.model";
import { PendingUpload } from "../models/attachment-upload.model";
import { Grievance } from "../models/grievance.model";
import { TransitionRequest } from "../models/grievance-transition-request.model";

const utapi = new UTApi();

/**
 * How long a generated link stays usable.
 *
 * Short enough that a link pasted into a chat or an email stops working, long
 * enough that opening a complaint and clicking through to a photo is a
 * single-step action rather than a re-authentication ritual.
 */
const SIGNED_URL_TTL = "10m";

function isAdminRole(role: string): boolean {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

/** A file the client says it just uploaded, before it is trusted. */
export interface ClaimedUpload {
  fileKey: string;
}

/**
 * Attach already-uploaded files to a complaint.
 *
 * The files themselves go straight to UploadThing; this records the claim. Each
 * key is resolved against the app's own record of the upload — written
 * server-side at the moment the upload completed — and rejected unless it belongs
 * to this account and has not already been claimed. Trusting the client's key
 * would let a caller attach another complaint's evidence, or a plausible string
 * that resolves to nothing.
 */
export async function attachToGrievance(
  grievanceId: string,
  uploads: ClaimedUpload[],
  actor: { userId: string; name: string; role: string },
  opts: { transitionRequestId?: string } = {},
) {
  if (uploads.length === 0) return [];

  const grievance = await Grievance.findById(grievanceId);
  if (!grievance || grievance.deletedAt) {
    throw ApiError.notFound("Complaint not found");
  }

  if (opts.transitionRequestId) {
    const request = await TransitionRequest.findById(opts.transitionRequestId);
    if (!request || request.grievanceId.toString() !== grievanceId) {
      throw ApiError.badRequest(
        "That request does not belong to this complaint",
      );
    }
    if (request.status !== "PENDING") {
      throw ApiError.badRequest("That request has already been decided");
    }
  }

  await assertActorMayTouch(grievance, actor);

  const existing = await Attachment.countDocuments({ grievanceId });
  if (existing + uploads.length > MAX_ATTACHMENTS_PER_GRIEVANCE) {
    throw ApiError.badRequest(
      `A complaint can hold at most ${MAX_ATTACHMENTS_PER_GRIEVANCE} attachments`,
    );
  }

  // The claim is atomic in its own right: two concurrent attempts to attach the
  // same upload cannot both win, because the second finds `claimedAt` already set.
  const claimed: {
    fileKey: string;
    name: string;
    size: number;
    contentType: string;
  }[] = [];

  for (const upload of uploads) {
    const pending = await PendingUpload.findOneAndUpdate(
      { fileKey: upload.fileKey, claimedAt: { $exists: false } },
      { $set: { claimedAt: new Date(), claimedByGrievanceId: grievance._id } },
      { new: true },
    );

    if (!pending) {
      const known = await PendingUpload.findOne({ fileKey: upload.fileKey });
      if (!known) {
        throw ApiError.badRequest("That file was not uploaded by this account");
      }
      if (known.uploadedBy.toString() !== actor.userId) {
        // Do not confirm the file exists to someone who does not own it.
        throw ApiError.forbidden("That file was not uploaded by this account");
      }
      throw ApiError.conflict("That file is already attached to a complaint");
    }

    if (!ALLOWED_CONTENT_TYPES.has(pending.contentType)) {
      throw ApiError.badRequest(
        `Unsupported file type: ${pending.contentType}`,
      );
    }
    if (pending.size > MAX_ATTACHMENT_BYTES) {
      throw ApiError.badRequest(
        `Attachments must be under ${Math.floor(
          MAX_ATTACHMENT_BYTES / (1024 * 1024),
        )}MB`,
      );
    }

    claimed.push({
      fileKey: pending.fileKey,
      name: pending.name,
      size: pending.size,
      contentType: pending.contentType,
    });
  }

  try {
    return await Attachment.insertMany(
      claimed.map((file) => ({
        grievanceId: grievance._id,
        transitionRequestId: opts.transitionRequestId
          ? new mongoose.Types.ObjectId(opts.transitionRequestId)
          : undefined,
        fileKey: file.fileKey,
        name: file.name,
        size: file.size,
        contentType: file.contentType,
        uploadedBy: new mongoose.Types.ObjectId(actor.userId),
        uploadedByName: actor.name,
      })),
    );
  } catch (err) {
    // Never leave an upload marked claimed but unattached: it would be
    // unreclaimable and the user would have no way to retry.
    await PendingUpload.updateMany(
      { fileKey: { $in: claimed.map((f) => f.fileKey) } },
      { $unset: { claimedAt: "", claimedByGrievanceId: "" } },
    );
    throw err;
  }
}

/** Staff may only add evidence to complaints they are working on. */
async function assertActorMayTouch(
  grievance: {
    primaryAssigneeId?: mongoose.Types.ObjectId;
    supportingAssignees: mongoose.Types.ObjectId[];
  },
  actor: { userId: string; role: string },
) {
  if (isAdminRole(actor.role)) return;
  const assigned =
    grievance.primaryAssigneeId?.toString() === actor.userId ||
    grievance.supportingAssignees.some((id) => id.toString() === actor.userId);
  if (!assigned) {
    throw ApiError.forbidden(
      "You can only attach evidence to complaints assigned to you",
    );
  }
}

// ─── Reading ────────────────────────────────────────────────────────────────

/**
 * A complaint's evidence, each with a freshly signed URL.
 *
 * The URL is generated per request and short-lived, so it cannot be stored by a
 * client or pasted somewhere it will outlive its permission. Access is checked
 * before any URL is minted — that check is the only thing standing between the
 * evidence and anyone who knows a grievance id.
 */
export async function listWithSignedUrls(
  grievanceId: string,
  actor: { userId: string; role: string },
) {
  const grievance = await Grievance.findById(grievanceId)
    .select("primaryAssigneeId supportingAssignees")
    .lean();
  if (!grievance) throw ApiError.notFound("Complaint not found");

  await assertActorMayTouch(grievance, actor);

  const attachments = await Attachment.find({ grievanceId })
    .sort({ createdAt: 1 })
    .lean();

  return Promise.all(
    attachments.map(async (attachment) => ({
      id: attachment._id.toString(),
      name: attachment.name,
      size: attachment.size,
      contentType: attachment.contentType,
      uploadedByName: attachment.uploadedByName,
      createdAt: attachment.createdAt,
      isImage: attachment.contentType.startsWith("image/"),
      url: await signUrlFor(attachment.fileKey),
    })),
  );
}

/** One attachment's live URL, permission checked against its complaint. */
export async function getSignedUrl(
  attachmentId: string,
  actor: { userId: string; role: string },
) {
  const attachment = await Attachment.findById(attachmentId).lean();
  if (!attachment) throw ApiError.notFound("Attachment not found");

  const grievance = await Grievance.findById(attachment.grievanceId)
    .select("primaryAssigneeId supportingAssignees")
    .lean();
  if (!grievance) throw ApiError.notFound("Complaint not found");

  await assertActorMayTouch(grievance, actor);

  return {
    id: attachment._id.toString(),
    name: attachment.name,
    url: await signUrlFor(attachment.fileKey),
  };
}

/**
 * Mint a signed URL for a private file.
 *
 * `generateSignedURL` is local — it signs with the app's own key rather than
 * calling UploadThing — so listing a complaint's evidence does not cost a network
 * round trip per file.
 */
async function signUrlFor(fileKey: string): Promise<string> {
  try {
    const { ufsUrl } = await utapi.generateSignedURL(fileKey, {
      expiresIn: SIGNED_URL_TTL,
    });
    return ufsUrl;
  } catch {
    // A stored key whose file has since been removed from storage. Say so rather
    // than handing back a broken URL that looks like a permissions problem.
    throw ApiError.badRequest("That file is no longer available in storage");
  }
}

// ─── Removing ───────────────────────────────────────────────────────────────

/**
 * Delete an attachment and its underlying file.
 *
 * Both halves matter: dropping the row leaves the file readable in the bucket,
 * and deleting the file leaves a row pointing at nothing. UploadThing is
 * contacted after the row is removed so a storage failure cannot leave a
 * dangling record the app would keep offering.
 */
export async function removeAttachment(
  attachmentId: string,
  actor: { userId: string; role: string },
) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) throw ApiError.notFound("Attachment not found");

  const grievance = await Grievance.findById(attachment.grievanceId)
    .select("primaryAssigneeId supportingAssignees referenceCode")
    .lean();
  if (!grievance) throw ApiError.notFound("Complaint not found");

  // An admin may remove anything; staff only what they uploaded themselves.
  if (
    !isAdminRole(actor.role) &&
    attachment.uploadedBy.toString() !== actor.userId
  ) {
    throw ApiError.forbidden("You can only remove evidence you uploaded");
  }

  // The row goes first. If the storage delete then fails, the leftover file is
  // unreferenced and costs storage — strictly better than a row the app keeps
  // offering that resolves to a deleted file.
  await Attachment.deleteOne({ _id: attachment._id });

  try {
    await utapi.deleteFiles(attachment.fileKey);
  } catch {
    // Nothing actionable: the record the app serves is already gone.
  }

  return {
    fileKey: attachment.fileKey,
    referenceCode: grievance.referenceCode,
  };
}

/**
 * How many attachments a complaint holds, so the move panel knows whether the
 * evidence requirement is met.
 *
 * Authorised like every other read. Counting alone is not harmless — an
 * unguarded count would let any staff member probe complaints they are not
 * assigned to and learn whether evidence exists on them.
 */
export async function countFor(
  grievanceId: string,
  actor: { userId: string; role: string },
): Promise<number> {
  const grievance = await Grievance.findById(grievanceId)
    .select("primaryAssigneeId supportingAssignees")
    .lean();
  if (!grievance) throw ApiError.notFound("Complaint not found");

  await assertActorMayTouch(grievance, actor);

  return Attachment.countDocuments({ grievanceId });
}

export type { IAttachment };
