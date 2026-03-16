import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const erequestId = getRouterParam(event, "id")!;
  const blobId = getRouterParam(event, "blobId")!;
  const blob = await cxt.getErequestsRepository().getBlob(erequestId, blobId);

  if (!blob) {
    throw createError({
      statusCode: 404,
      statusMessage: "Blob not found",
    });
  }

  const object = await cxt.getBlobStorageService().getObjectStream({
    key: blob.storageKey,
  });

  setHeader(event, "Content-Type", blob.contentType || object.contentType || "application/octet-stream");
  const contentLength = blob.byteSize || object.byteSize;
  if (contentLength) {
    setHeader(event, "Content-Length", contentLength);
  }

  const disposition = getQuery(event).download === "1" ? "attachment" : "inline";
  setHeader(
    event,
    "Content-Disposition",
    `${disposition}; filename="${blob.filename.replace(/"/g, "")}"`
  );

  return sendStream(event, object.stream);
});
