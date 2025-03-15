import type {
  Graffiti,
  JSONSchema,
  GraffitiObjectUrl,
  GraffitiPutObject,
  GraffitiPatch,
} from "@graffiti-garden/api";
import {
  GraffitiErrorForbidden,
  GraffitiErrorSchemaMismatch,
} from "@graffiti-garden/api";
import type { GraffitiSessionOIDC } from "./types";
import { compileGraffitiObjectSchema } from "@graffiti-garden/implementation-local/utilities";
import { parseGraffitiObjectResponse } from "./decode-response";
import {
  encodeJSONBody,
  encodeQueryParams,
  graffitiUrlToHTTPUrl,
} from "./encode-request";
import type Ajv from "ajv";

//@ts-ignore
export class GraffitiRemoteCrud
  implements Pick<Graffiti, "get" | "put" | "patch" | "delete">
{
  useAjv: () => Promise<Ajv>;
  origin: string;
  httpOrigin: string;
  constructor(origin: string, useAjv: () => Promise<Ajv>) {
    this.origin = origin;
    this.httpOrigin = graffitiUrlToHTTPUrl(origin);
    this.useAjv = useAjv;
  }

  async get<Schema extends JSONSchema>(
    url: GraffitiObjectUrl | string,
    schema: Schema,
    session?: GraffitiSessionOIDC,
  ) {
    const httpUrl = graffitiUrlToHTTPUrl(url);

    const httpGetUrl = encodeQueryParams(httpUrl, { schema });
    const response = await (session?.fetch ?? fetch)(httpGetUrl);
    const object = await parseGraffitiObjectResponse(response, url);
    const validate = compileGraffitiObjectSchema(await this.useAjv(), schema);
    if (!validate(object)) {
      throw new GraffitiErrorSchemaMismatch(
        "The fetched object does not match the provided schema.",
      );
    }
    return object;
  }

  async put<Schema extends JSONSchema>(
    object: GraffitiPutObject<Schema>,
    session: GraffitiSessionOIDC,
  ) {
    if (object.actor && object.actor !== session.actor) {
      throw new GraffitiErrorForbidden(
        "The actor in the object does not match the session actor.",
      );
    }
    const httpUrl = object.url
      ? graffitiUrlToHTTPUrl(object.url)
      : this.httpOrigin + "/create";

    const requestInit: RequestInit = { method: object.url ? "PUT" : "POST" };

    encodeJSONBody(requestInit, object.value);
    const putUrl = encodeQueryParams(httpUrl, {
      channels: object.channels,
      allowed: object.allowed,
    });
    const response = await session.fetch(putUrl, requestInit);
    return await parseGraffitiObjectResponse(response, object.url);
  }

  async patch(
    patch: GraffitiPatch,
    url: GraffitiObjectUrl | string,
    session: GraffitiSessionOIDC,
  ) {
    const httpUrl = graffitiUrlToHTTPUrl(url);
    const requestInit: RequestInit = { method: "PATCH" };
    if (patch.value) {
      encodeJSONBody(requestInit, patch.value);
    }
    const patchUrl = encodeQueryParams(httpUrl, {
      channels: patch.channels?.map((p) => JSON.stringify(p)),
      allowed: patch.allowed?.map((p) => JSON.stringify(p)),
    });
    const response = await session.fetch(patchUrl, requestInit);
    return await parseGraffitiObjectResponse(response, url);
  }

  async delete(url: GraffitiObjectUrl | string, session: GraffitiSessionOIDC) {
    const httpUrl = graffitiUrlToHTTPUrl(url);
    const response = await session.fetch(httpUrl, { method: "DELETE" });
    return await parseGraffitiObjectResponse(response, url);
  }
}
