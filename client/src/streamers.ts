import { Graffiti, GraffitiErrorSchemaMismatch } from "@graffiti-garden/api";
import type {
  ChannelStats,
  GraffitiObjectBase,
  GraffitiObjectStreamContinue,
  GraffitiObjectStreamContinueEntry,
  GraffitiObjectStreamEntry,
  GraffitiObjectStreamReturn,
  GraffitiSession,
  JSONSchema,
} from "@graffiti-garden/api";
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
  value: ChannelStats;
}> = {
  type: "object",
  required: ["value"],
  properties: {
    value: {
      type: "object",
      properties: {
        channel: { type: "string" },
        count: { type: "number" },
        lastModified: { type: "number" },
      },
      required: ["channel", "count", "lastModified"],
    },
  },
};

export const GRAFFITI_OBJECT_STREAM_CONTINUE_ENTRY_SCHEMA: JSONSchemaType<
  GraffitiObjectStreamContinueEntry<{}>
> = {
  type: "object",
  required: ["object"],
  oneOf: [
    {
      properties: {
        object: GraffitiObjectJSONSchema,
        tombstone: { type: "boolean", nullable: true },
      },
    },
    {
      required: ["tombstone"],
      properties: {
        tombstone: {
          type: "boolean",
          enum: [true],
        },
        object: {
          type: "object",
          required: ["url", "lastModified"],
          properties: {
            url: { type: "string" },
            lastModified: { type: "number" },
          },
        },
      },
    },
  ],
};

export const GRAFFITI_OBJECT_STREAM_RETURN_SCHEMA: JSONSchemaType<{
  cursor: string;
}> = {
  type: "object",
  required: ["cursor"],
  properties: {
    cursor: { type: "string" },
  },
};

export class GraffitiRemoteStreamers {
  origin: string;
  httpOrigin: string;
  validateObjectStreamEntry_:
    | Promise<ValidateFunction<GraffitiObjectStreamEntry<{}>>>
    | undefined;
  validateObjectStreamContinueEntry_:
    | Promise<ValidateFunction<GraffitiObjectStreamContinueEntry<{}>>>
    | undefined;
  validateObjectStreamReturn_:
    | Promise<ValidateFunction<{ cursor: string }>>
    | undefined;
  validateChannelStats_:
    | Promise<ValidateFunction<{ value: ChannelStats; error?: undefined }>>
    | undefined;
  useAjv: () => Promise<Ajv>;

  get validateObjectStreamContinueEntry() {
    if (!this.validateObjectStreamContinueEntry_) {
      this.validateObjectStreamContinueEntry_ = this.useAjv().then((ajv) =>
        ajv.compile(GRAFFITI_OBJECT_STREAM_CONTINUE_ENTRY_SCHEMA),
      );
    }
    return this.validateObjectStreamContinueEntry_;
  }

  get validateObjectStreamReturn() {
    if (!this.validateObjectStreamReturn_) {
      this.validateObjectStreamReturn_ = this.useAjv().then((ajv) =>
        ajv.compile(GRAFFITI_OBJECT_STREAM_RETURN_SCHEMA),
      );
    }
    return this.validateObjectStreamReturn_;
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

    const iterator = parseJSONLinesResponse<
      GraffitiObjectStreamContinueEntry<Schema>,
      GraffitiObjectStreamReturn<Schema>
    >(
      response,
      this.httpOrigin,
      async (entry): Promise<GraffitiObjectStreamContinueEntry<Schema>> => {
        if (!(await this.validateObjectStreamContinueEntry)(entry)) {
          throw new Error("Source returned a non-Graffiti object");
        }
        if (!entry.object.url.startsWith(this.origin)) {
          throw new Error(
            "Origin returned an object claiming to be from another origin",
          );
        }
        if (entry.tombstone) {
          return entry;
        }
        const object = entry.object;
        if (!isActorAllowedGraffitiObject(object, session)) {
          throw new Error(
            "Origin returned an object that the session is not allowed to see",
          );
        }
        isDesired(object);
        if (!validate(object)) {
          throw new GraffitiErrorSchemaMismatch();
        }
        return { object };
      },
      async (returnValue) => {
        if (!(await this.validateObjectStreamReturn)(returnValue)) {
          throw new Error("Source returned a non-Graffiti object");
        }
        const cursor = returnValue.cursor;
        // TODO: store meta data for the cursor locally to
        // preserve typing.
        return {
          cursor,
          continue: () =>
            this.continueObjectStream(
              cursor,
              session,
            ) as unknown as GraffitiObjectStreamContinue<Schema>,
        };
      },
    );

    while (true) {
      const entry = await iterator.next();
      if (entry.done) {
        return entry.value;
      } else {
        yield entry.value;
      }
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
    const iterator = this.streamObjects<Schema>(
      url,
      isDesired,
      schema,
      session,
    );

    return (async function* () {
      while (true) {
        const entry = await iterator.next();
        if (entry.done) {
          return entry.value;
        } else {
          if (!entry.value.error && entry.value.tombstone) continue;
          yield entry.value;
        }
      }
    })();
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
    const iterator = this.streamObjects<Schema>(
      url,
      isDesired,
      schema,
      session,
    );

    return (async function* () {
      while (true) {
        const entry = await iterator.next();
        if (entry.done) {
          return entry.value;
        } else {
          if (!entry.value.error && entry.value.tombstone) continue;
          yield entry.value;
        }
      }
    })();
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
      (o) => {
        if (o !== undefined) {
          throw new Error("Unexpected return value from channel stats");
        }
        return o;
      },
    );
  }

  continueObjectStream(
    cursor: string,
    session?: GraffitiSessionOIDC | null,
  ): ReturnType<Graffiti["continueObjectStream"]> {
    const url = encodeQueryParams(`${this.httpOrigin}/continue`, {
      cursor,
    });
    return this.streamObjects<{}>(url, () => true, {}, session);
  }
}
