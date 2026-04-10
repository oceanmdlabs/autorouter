export type Attachment = {
  title: string;
  contentType?: string;
  data: Buffer<ArrayBufferLike>;
};
