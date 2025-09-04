import type { ResponseInit as NodeResponseInit } from "node-fetch";
export type HttpResponseInit = NodeResponseInit & {
  body?: string;
};
