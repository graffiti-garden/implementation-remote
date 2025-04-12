import type Ajv from "ajv";
import type {
  Graffiti,
  GraffitiChannelStatsStream,
  GraffitiObjectStream,
  GraffitiObjectStreamContinue,
  GraffitiObjectUrl,
  GraffitiPatch,
  GraffitiPutObject,
  GraffitiSession,
  JSONSchema,
} from "@graffiti-garden/api";
import { GraffitiRemoteDatabase } from "./database";
import { graffitiUrlToHTTPUrl } from "./encode-request";
import type { GraffitiRemoteOptions, GraffitiSessionOIDC } from "./types";

export class GraffitiMultipleRemoteDatabases
  implements Omit<Graffiti, "login" | "logout" | "sessionEvents">
{
  protected databases: Map<string, GraffitiRemoteDatabase> = new Map();
  protected options: GraffitiRemoteOptions;

  constructor(options: GraffitiRemoteOptions) {
    this.options = options;
    for (const origin of options.registry) {
      this.databases.set(
        origin,
        new GraffitiRemoteDatabase({
          origin,
          ajv: options.ajv,
        }),
      );
    }
  }

  whichDatabase(urlObject: GraffitiObjectUrl | string): GraffitiRemoteDatabase {
    const url = new URL(graffitiUrlToHTTPUrl(urlObject));
    let origin = url.origin;
    if (origin.startsWith("https://")) {
      origin = origin.slice(8);
    }
    origin = "graffiti:remote:" + origin;
    let database = this.databases.get(origin);
    if (!database) {
      database = new GraffitiRemoteDatabase({
        origin: origin,
        ajv: this.options.ajv,
      });
      this.databases.set(origin, database);
    }
    return database;
  }

  async get<Schema extends JSONSchema>(
    url: GraffitiObjectUrl | string,
    schema: Schema,
    session?: GraffitiSessionOIDC,
  ) {
    const database = this.whichDatabase(url);
    return database.get(url, schema, session);
  }

  async put<Schema extends JSONSchema>(
    object: GraffitiPutObject<Schema>,
    session: GraffitiSessionOIDC,
  ) {
    if (object.url) {
      const database = this.whichDatabase(object.url);
      return database.put(object, session);
    } else {
      // TODO: bring back the modal once we stand
      // up another server again and bring the solid implementation
      // into the mix again.
      return this.databases.values().next().value!.put(object, session);
    }
  }

  async patch(
    patch: GraffitiPatch,
    url: GraffitiObjectUrl | string,
    session: GraffitiSessionOIDC,
  ) {
    const database = this.whichDatabase(url);
    return database.patch(patch, url, session);
  }

  async delete(url: GraffitiObjectUrl | string, session: GraffitiSessionOIDC) {
    const database = this.whichDatabase(url);
    return database.delete(url, session);
  }

  discover<Schema extends JSONSchema>(
    channels: string[],
    schema: Schema,
    session?: GraffitiSessionOIDC | null,
  ): ReturnType<typeof Graffiti.prototype.discover<Schema>> {
    const this_ = this;
    async function* mergeIterators(): ReturnType<
      typeof Graffiti.prototype.discover<Schema>
    > {
      const cursor: Record<string, string> = {};

      for (const [origin, database] of this_.databases.entries()) {
        const iterator = database.discover(channels, schema, session);
        while (true) {
          const result = await iterator.next();
          if (result.done) {
            cursor[origin] = result.value.cursor;
            break;
          }
          yield result.value;
        }
      }

      const cursorString = "discover-mult:" + JSON.stringify(cursor);

      return {
        cursor: cursorString,
        continue: () =>
          this_.continueObjectStream(
            cursorString,
            session,
          ) as unknown as GraffitiObjectStreamContinue<typeof schema>,
      };
    }

    return mergeIterators();
  }

  continueObjectStream(
    cursor: string,
    session?: GraffitiSessionOIDC | null,
  ): ReturnType<Graffiti["continueObjectStream"]> {
    if (cursor.startsWith("discover-mult:")) {
      const cursors = JSON.parse(cursor.slice(14)) as Record<string, string>;
      const this_ = this;
      async function* mergeIterators(): ReturnType<
        Graffiti["continueObjectStream"]
      > {
        for (const [origin, database] of this_.databases.entries()) {
          const cursor = cursors[origin];
          if (!cursor) continue;
          // TODO: if the cursor does not exist, start a new stream

          const iterator = database.continueObjectStream(cursor, session);
          while (true) {
            const result = await iterator.next();
            if (result.done) {
              cursors[origin] = result.value.cursor;
              break;
            }
            yield result.value;
          }
        }

        const cursorString = "discover-mult:" + JSON.stringify(cursor);
        return {
          cursor: cursorString,
          continue: () => this_.continueObjectStream(cursorString, session),
        };
      }
      return mergeIterators();
    } else {
      // TODO: fix this, for now just return from the first database
      return this.databases
        .values()
        .next()
        .value!.continueObjectStream(cursor, session);
    }
  }

  recoverOrphans: Graffiti["recoverOrphans"] = (...args) => {
    // TODO: fix this, for now just return from the first database
    return this.databases
      .values()
      .next()
      .value!.recoverOrphans(...args);
  };

  channelStats: Graffiti["channelStats"] = (...args) => {
    // TODO: fix this, for now just return from the first database
    return this.databases
      .values()
      .next()
      .value!.channelStats(...args);
  };
}
