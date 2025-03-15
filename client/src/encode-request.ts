import {
  GraffitiErrorUnrecognizedUriScheme,
  type GraffitiObjectUrl,
  type JSONSchema,
} from "@graffiti-garden/api";
import { unpackLocationOrUri } from "@graffiti-garden/implementation-local/utilities";

function addHeader(requestInit: RequestInit, key: string, value: string): void {
  if (!requestInit.headers || !(requestInit.headers instanceof Headers)) {
    requestInit.headers = new Headers();
  }
  requestInit.headers.set(key, value);
}

function encodeStringArray(stringArray: string[]): string {
  return stringArray.map(encodeURIComponent).join(",");
}

export function encodeQueryParams(
  url: string,
  params: {
    channels?: string[];
    allowed?: string[] | null;
    schema?: JSONSchema;
  },
) {
  url += "?";
  if (params.channels) {
    url += "channels=" + encodeStringArray(params.channels) + "&";
  }
  if (params.allowed) {
    url += "allowed=" + encodeStringArray(params.allowed) + "&";
  }
  if (params.schema) {
    url += "schema=" + encodeURIComponent(JSON.stringify(params.schema)) + "&";
  }
  return url;
}

export function encodeJSONBody(requestInit: RequestInit, body: any): void {
  addHeader(requestInit, "Content-Type", "application/json; charset=utf-8");
  requestInit.body = JSON.stringify(body);
}

export function graffitiUrlToHTTPUrl(urlObject: GraffitiObjectUrl | string) {
  const url = unpackLocationOrUri(urlObject);
  if (!url.startsWith("graffiti:remote:")) {
    throw new GraffitiErrorUnrecognizedUriScheme(
      "The provided URI does not use the 'graffiti:remote:' scheme.",
    );
  }
  let httpUrl = url.slice("graffiti:remote:".length);
  // Assume https if no scheme is provided
  if (!httpUrl.startsWith("https://") && !httpUrl.startsWith("http://")) {
    httpUrl = "https://" + httpUrl;
  }
  return httpUrl;
}
