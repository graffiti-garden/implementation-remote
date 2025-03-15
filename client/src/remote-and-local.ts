import {
  GraffitiErrorForbidden,
  GraffitiErrorUnrecognizedUrlScheme,
  type GraffitiSession,
} from "@graffiti-garden/api";
import type {
  GraffitiObjectStreamContinue,
  GraffitiObjectStreamReturn,
  GraffitiObjectUrl,
} from "@graffiti-garden/api";
import type { Graffiti } from "@graffiti-garden/api";
import { unpackObjectUrl } from "@graffiti-garden/implementation-local/utilities";

type GraffitiBase = Omit<Graffiti, "login" | "logout" | "sessionEvents">;

export class GraffitiRemoteAndLocal implements GraffitiBase {
  protected readonly localGraffiti: GraffitiBase;
  protected readonly remoteGraffiti: GraffitiBase;
  constructor(localGraffiti: GraffitiBase, remoteGraffiti: GraffitiBase) {
    this.localGraffiti = localGraffiti;
    this.remoteGraffiti = remoteGraffiti;
  }

  protected isRemoteSession(session?: GraffitiSession | null) {
    return session && session.actor.startsWith("http") && "fetch" in session;
  }
  protected isRemoteUrl(objectUrl: string | GraffitiObjectUrl) {
    const url = unpackObjectUrl(objectUrl);
    return url.startsWith("graffiti:remote:");
  }
  protected isLocalUrl(objectUrl: string | GraffitiObjectUrl) {
    const url = unpackObjectUrl(objectUrl);
    return url.startsWith("graffiti:local:");
  }

  get: Graffiti["get"] = async (...args) => {
    const [url, schema, session] = args;
    if (this.isRemoteUrl(url)) {
      return this.remoteGraffiti.get<typeof schema>(
        url,
        schema,
        this.isRemoteSession(session) ? session : undefined,
      );
    } else if (this.isLocalUrl(url)) {
      return this.localGraffiti.get<typeof schema>(...args);
    } else {
      throw new GraffitiErrorUnrecognizedUrlScheme(
        `Unrecognized URL Scheme: ${url}`,
      );
    }
  };

  put: Graffiti["put"] = (...args) => {
    const [object, session] = args;
    if (!object.url) {
      if (this.isRemoteSession(session)) {
        return this.remoteGraffiti.put<{}>(...args);
      } else {
        return this.localGraffiti.put<{}>(...args);
      }
    } else if (this.isRemoteUrl(object.url)) {
      if (!this.isRemoteSession(session)) {
        throw new GraffitiErrorForbidden(
          "Cannot put a remote graffiti object with a local session",
        );
      }
      return this.remoteGraffiti.put<{}>(...args);
    } else if (this.isLocalUrl(object.url)) {
      return this.localGraffiti.put<{}>(...args);
    } else {
      throw new GraffitiErrorUnrecognizedUrlScheme(
        `Unrecognized URI Scheme: ${object.url}`,
      );
    }
  };

  delete: Graffiti["delete"] = (...args) => {
    const [url, session] = args;
    if (this.isRemoteUrl(url)) {
      if (!this.isRemoteSession(session)) {
        throw new GraffitiErrorForbidden(
          "Cannot delete a remote graffiti object with a local session",
        );
      }
      return this.remoteGraffiti.delete(...args);
    } else if (this.isLocalUrl(url)) {
      return this.localGraffiti.delete(...args);
    } else {
      throw new GraffitiErrorUnrecognizedUrlScheme(
        `Unrecognized URL Scheme: ${url}`,
      );
    }
  };

  patch: Graffiti["patch"] = (...args) => {
    const [_, url, session] = args;
    if (this.isRemoteUrl(url)) {
      if (!this.isRemoteSession(session)) {
        throw new GraffitiErrorForbidden(
          "Cannot patch a remote graffiti object with a local session",
        );
      }
      return this.remoteGraffiti.patch(...args);
    } else if (this.isLocalUrl(url)) {
      return this.localGraffiti.patch(...args);
    } else {
      throw new GraffitiErrorUnrecognizedUrlScheme(
        `Unrecognized URL Scheme: ${url}`,
      );
    }
  };

  discover: Graffiti["discover"] = (...args) => {
    const [channels, schema, session] = args;
    const localIterator = this.localGraffiti.discover(...args);
    const remoteIterator = this.remoteGraffiti.discover(
      channels,
      schema,
      this.isRemoteSession(session) ? session : undefined,
    );

    let localReturnValue: GraffitiObjectStreamReturn<typeof schema> | undefined;

    return {
      next: async () => {
        if (!localReturnValue) {
          const localResult = await localIterator.next();
          if (!localResult.done) {
            return localResult;
          }
          localReturnValue = localResult.value;
        }

        const remoteResult = await remoteIterator.next();
        if (!remoteResult.done) return remoteResult;

        // Both are done, merge their results
        const cursor =
          "discover:" +
          JSON.stringify({
            remote: remoteResult.value.cursor,
            local: localReturnValue.cursor,
          });
        return {
          done: true,
          value: {
            cursor,
            continue: () =>
              this.continueObjectStream(
                cursor,
                session,
              ) as unknown as GraffitiObjectStreamContinue<typeof schema>,
          },
        };
      },
      return: remoteIterator.return,
      throw: remoteIterator.throw,
      [Symbol.asyncIterator]() {
        return this;
      },
      async [Symbol.asyncDispose]() {
        return;
      },
    };
  };

  recoverOrphans: Graffiti["recoverOrphans"] = (...args) => {
    if (this.isRemoteSession(args[1])) {
      return this.remoteGraffiti.recoverOrphans<(typeof args)[0]>(...args);
    } else {
      return this.localGraffiti.recoverOrphans<(typeof args)[0]>(...args);
    }
  };

  channelStats: Graffiti["channelStats"] = (...args) => {
    if (this.isRemoteSession(args[0])) {
      return this.remoteGraffiti.channelStats(...args);
    } else {
      return this.localGraffiti.channelStats(...args);
    }
  };

  continueObjectStream: Graffiti["continueObjectStream"] = (...args) => {
    const [cursor, session] = args;
    if (!cursor.startsWith("discover:")) {
      if (this.isRemoteSession(session)) {
        return this.remoteGraffiti.continueObjectStream(...args);
      } else {
        return this.localGraffiti.continueObjectStream(...args);
      }
    }

    const { remote, local } = JSON.parse(cursor.slice("discover:".length));
    const localIterator = this.localGraffiti.continueObjectStream(
      local,
      session,
    );
    const remoteIterator = this.remoteGraffiti.continueObjectStream(
      remote,
      this.isRemoteSession(session) ? session : undefined,
    );

    let localReturnValue: GraffitiObjectStreamReturn<{}> | undefined;

    return {
      next: async () => {
        if (!localReturnValue) {
          const localResult = await localIterator.next();
          if (!localResult.done) {
            return localResult;
          }
          localReturnValue = localResult.value;
        }

        const remoteResult = await remoteIterator.next();
        if (!remoteResult.done) return remoteResult;

        // Both are done, merge their results
        const cursor =
          "discover:" +
          JSON.stringify({
            remote: remoteResult.value.cursor,
            local: localReturnValue.cursor,
          });
        return {
          done: true,
          value: {
            cursor,
            continue: () => this.continueObjectStream(cursor, session),
          },
        };
      },
      return: remoteIterator.return,
      throw: remoteIterator.throw,
      [Symbol.asyncIterator]() {
        return this;
      },
      async [Symbol.asyncDispose]() {
        return;
      },
    };
  };
}
