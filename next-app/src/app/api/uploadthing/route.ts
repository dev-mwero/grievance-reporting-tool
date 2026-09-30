import { createRouteHandler } from "uploadthing/next";
import { attachmentUploader } from "@/server/uploadthing";

export const { GET, POST } = createRouteHandler({
  router: attachmentUploader,
});
