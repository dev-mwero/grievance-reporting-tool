import mongoose from "mongoose";
import { createUploadthing } from "uploadthing/next";
import { type FileRouter, UploadThingError } from "uploadthing/server";
import { ACCESS_COOKIE } from "@/server/auth";
import { ALLOWED_CONTENT_TYPES } from "@/server/models/attachment.model";
import { PendingUpload } from "@/server/models/attachment-upload.model";
import { verifyAccessToken } from "@/server/token";

const f = createUploadthing();

/**
 * Attachment limits.
 *
 * Deliberately generous for evidence photos but capped: an unbounded upload is
 * both a storage cost and a denial-of-service surface, and the app has no way to
 * reclaim space from a user who uploads and then abandons the complaint.
 */
const MAX_FILE_SIZE = "8MB";
const MAX_FILE_COUNT = 5;

/**
 * The storage route for complaint evidence.
 *
 * Files go straight here from the browser rather than through an app route, so
 * the route has to establish who is uploading on its own account of the request.
 * The MIME allow-list lives with the model — `ALLOWED_CONTENT_TYPES` — because
 * the API trusts it later when a client claims an attachment, and a check that
 * exists on only one side of that claim proves nothing.
 */
export const attachmentUploader = {
  evidence: f(
    {
      // UploadThing's buckets are image/video/audio/pdf/text/blob. Office
      // documents have no bucket of their own, so they fall to `blob`; the MIME
      // allow-list below is what actually decides what is accepted.
      //
      // `acl` is set per bucket, not per route — without it each file stays
      // readable by anyone holding its CDN URL, permanently, and these
      // attachments carry names, locations and photographs of people.
      image: {
        maxFileSize: MAX_FILE_SIZE,
        maxFileCount: MAX_FILE_COUNT,
        acl: "private",
      },
      pdf: {
        maxFileSize: MAX_FILE_SIZE,
        maxFileCount: MAX_FILE_COUNT,
        acl: "private",
      },
      blob: {
        maxFileSize: MAX_FILE_SIZE,
        maxFileCount: MAX_FILE_COUNT,
        acl: "private",
      },
    },
    {},
  )
    .middleware(async ({ req }) => {
      // The upload route sits outside the app's route guards, so it has to
      // authenticate for itself. Reading the cookie off the request rather than
      // via next/headers keeps this working inside UploadThing's adapter.
      const token = req.cookies.get(ACCESS_COOKIE)?.value;
      if (!token) {
        throw new UploadThingError("Unauthorized");
      }
      try {
        return { actorId: verifyAccessToken(token).userId };
      } catch {
        throw new UploadThingError("Unauthorized");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Defence in depth. The middleware proves who is calling, but this is the
      // last point before a file enters the account's storage, so the type is
      // re-checked here rather than trusted from the client.
      if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
        throw new UploadThingError(`Unsupported file type: ${file.type}`);
      }

      // Record the upload while the app still knows it happened. This is what
      // makes the later claim verifiable: the key is looked up in constant time
      // and compared against the account that performed the upload, rather than
      // trusting a key the client could have invented or stolen.
      await PendingUpload.findOneAndUpdate(
        { fileKey: file.key },
        {
          $setOnInsert: {
            fileKey: file.key,
            name: file.name,
            size: file.size,
            contentType: file.type,
            uploadedBy: new mongoose.Types.ObjectId(metadata.actorId),
          },
        },
        { upsert: true, new: true },
      );

      return {
        fileKey: file.key,
        name: file.name,
        size: file.size,
        contentType: file.type,
      };
    }),
} satisfies FileRouter;

export type AttachmentFileRouter = typeof attachmentUploader;
