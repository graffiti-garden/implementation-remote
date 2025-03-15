import { Graffiti, GraffitiErrorSchemaMismatch } from "@graffiti-garden/api";
import type { GraffitiObjectBase, JSONSchema } from "@graffiti-garden/api";
import { GraffitiObjectJSONSchema } from "@graffiti-garden/api";
import type Ajv from "ajv";
import type { JSONSchemaType, ValidateFunction } from "ajv";
import {
  compileGraffitiObjectSchema,
  isActorAllowedGraffitiObject,
} from "@graffiti-garden/implementation-local/utilities";
import { parseJSONLinesResponse } from "./decode-response";
import { encodeQueryParams, graffitiUrlToHTTPUrl } from "./encode-request";
import type { GraffitiSessionOIDC } from "./types";

export const GRAFFITI_CHANNEL_STATS_SCHEMA: JSONSchemaType<{
  channel: string;
  count: number;
  lastModified: number;
}> = {
  type: "object",
  properties: {
    channel: { type: "string" },
    count: { type: "number" },
    lastModified: { type: "number" },
  },
  required: ["channel", "count", "lastModified"],
};

export class GraffitiRemoteStreamers {
  origin: string;
  httpOrigin: string;
  validateGraffitiObject_:
    | Promise<ValidateFunction<GraffitiObjectBase>>
    | undefined;
  validateChannelStats_:
    | Promise<
        ValidateFunction<{
          channel: string;
          count: number;
          lastModified: number;
        }>
      >
    | undefined;
  useAjv: () => Promise<Ajv>;

  get validateGraffitiObject() {
    if (!this.validateGraffitiObject_) {
      this.validateGraffitiObject_ = this.useAjv().then((ajv) =>
        ajv.compile(GraffitiObjectJSONSchema),
      );
    }
    return this.validateGraffitiObject_;
  }
  get validateChannelStats() {
    if (!this.validateChannelStats_) {
      this.validateChannelStats_ = this.useAjv().then((ajv) =>
        ajv.compile(GRAFFITI_CHANNEL_STATS_SCHEMA),
      );
    }
    return this.validateChannelStats_;
  }

  constructor(origin: string, useAjv: () => Promise<Ajv>) {
    this.origin = origin;
    this.httpOrigin = graffitiUrlToHTTPUrl(origin);
    this.useAjv = useAjv;
  }

  async *streamObjects<Schema extends JSONSchema>(
    url: string,
    isDesired: (object: GraffitiObjectBase) => void,
    schema: Schema,
    session?: GraffitiSessionOIDC | null,
  ) {
    const validate = compileGraffitiObjectSchema(await this.useAjv(), schema);
    const response = await (session?.fetch ?? fetch)(url);

    const iterator = parseJSONLinesResponse(
      response,
      this.httpOrigin,
      async (object) => {
        if (!(await this.validateGraffitiObject)(object)) {
          throw new Error("Source returned a non-Graffiti object");
        }
        if (!object.url.startsWith(this.origin)) {
          throw new Error(
            "Source returned an object claiming to be from another source",
          );
        }
        if (!isActorAllowedGraffitiObject(object, session)) {
          throw new Error(
            "Source returned an object that the session is not allowed to see",
          );
        }
        isDesired(object);
        if (!validate(object)) {
          throw new GraffitiErrorSchemaMismatch();
        }
        return object;
      },
    );

    try {
      for await (const object of iterator) {
        yield object;
      }
    } finally {
      // TODO: fix this
      return { tombstoneRetention: 999999999 };
    }
  }

  discover<Schema extends JSONSchema>(
    channels: string[],
    schema: Schema,
    session?: GraffitiSessionOIDC | null,
  ): ReturnType<typeof Graffiti.prototype.discover<Schema>> {
    const url = encodeQueryParams(`${this.httpOrigin}/discover`, {
      channels,
      schema,
    });
    const isDesired = (object: GraffitiObjectBase) => {
      if (!channels.some((channel) => object.channels.includes(channel))) {
        throw new Error(
          "Source returned an object not in the requested channels",
        );
      }
    };
    return this.streamObjects<Schema>(url, isDesired, schema, session);
  }

  recoverOrphans<Schema extends JSONSchema>(
    schema: Schema,
    session: GraffitiSessionOIDC,
  ): ReturnType<typeof Graffiti.prototype.discover<Schema>> {
    const url = encodeQueryParams(`${this.httpOrigin}/recover-orphans`, {
      schema,
    });
    const isDesired = (object: GraffitiObjectBase) => {
      if (object.actor !== session.actor) {
        throw new Error("Source returned an object not owned by the session");
      }
      if (object.channels.length !== 0) {
        throw new Error("Source returned an object with channels");
      }
    };
    return this.streamObjects<Schema>(url, isDesired, schema, session);
  }

  channelStats(
    session: GraffitiSessionOIDC,
  ): ReturnType<Graffiti["channelStats"]> {
    return parseJSONLinesResponse(
      session.fetch(`${this.httpOrigin}/channel-stats`),
      this.origin,
      async (object) => {
        if (!(await this.validateChannelStats)(object)) {
          throw new Error("Source returned a non-channel-stats object");
        }
        return object;
      },
    );
  }
}
