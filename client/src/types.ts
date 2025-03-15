import type Ajv from "ajv";
import type { GraffitiSession } from "@graffiti-garden/api";

export interface GraffitiSessionOIDC extends GraffitiSession {
  fetch: typeof fetch;
}

export interface GraffitiRemoteOptions {
  origin: string;
  ajv?: Ajv;
}
