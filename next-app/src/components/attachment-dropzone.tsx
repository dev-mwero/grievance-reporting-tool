"use client";

import { generateUploadDropzone } from "@uploadthing/react";
import type { AttachmentFileRouter } from "@/server/uploadthing";

/**
 * Typed dropzone for the attachment route.
 *
 * `generateUploadDropzone` is called once, at module scope, and the result is a
 * component whose `endpoint` prop is checked against the server's file router —
 * so naming a route that does not exist, or one with the wrong output type, is a
 * compile error rather than a runtime failure inside an upload.
 *
 * The router type is imported with `import type`, which erases it at build time,
 * so nothing from the server module reaches the browser bundle.
 */
export const UploadDropzone = generateUploadDropzone<AttachmentFileRouter>();
