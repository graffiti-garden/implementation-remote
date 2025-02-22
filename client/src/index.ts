import { Graffiti } from "@graffiti-garden/api";
import Ajv from "ajv";
import {
  GraffitiLocalDatabase,
  type GraffitiLocalOptions,
} from "@graffiti-garden/implementation-local/database";
import {
  locationToUri,
  uriToLocation,
} from "@graffiti-garden/implementation-local/utilities";
import type {
  GraffitiSolidOIDCSessionManagerOptions,
  GraffitiSolidOIDCSessionManager,
} from "@graffiti-garden/solid-oidc-session-manager";
import {
  GraffitiSingleServer,
  type GraffitiSingleServerOptions,
} from "./single-server";
import { GraffitiRemoteAndLocal } from "./remote-and-local";

export type { GraffitiSessionOIDC } from "./single-server/types";

export class GraffitiFederated extends Graffiti {
  locationToUri = locationToUri;
  uriToLocation = uriToLocation;

  put: Graffiti["put"];
  get: Graffiti["get"];
  patch: Graffiti["patch"];
  delete: Graffiti["delete"];
  discover: Graffiti["discover"];
  recoverOrphans: Graffiti["recoverOrphans"];
  channelStats: Graffiti["channelStats"];

  sessionEvents: Graffiti["sessionEvents"];
  sessionManager: Promise<GraffitiSolidOIDCSessionManager> | undefined;
  sessionManagerOptions: GraffitiSolidOIDCSessionManagerOptions | undefined;

  /**
   * Create a new Graffiti client that can interact with a federated set of pods.
   */
  constructor(options?: {
    local?: GraffitiLocalOptions;
    remote?: GraffitiSingleServerOptions;
    session?: GraffitiSolidOIDCSessionManagerOptions;
  }) {
    super();

    this.sessionEvents =
      this.sessionManagerOptions?.sessionEvents ?? new EventTarget();
    this.sessionManagerOptions = options?.session;

    // Restore the previous session by default
    if (this.sessionManagerOptions?.restorePreviousSession ?? true) {
      this.useSessionManager();
    }

    const ajv = new Ajv({ strict: false });
    const graffitiLocal = new GraffitiLocalDatabase({
      ...options?.local,
      ajv,
    });
    const graffitiRemote = new GraffitiSingleServer(
      options?.remote ?? {
        source: "https://pod.graffiti.garden",
      },
      ajv,
    );
    const graffitiRemoteAndLocal = new GraffitiRemoteAndLocal(
      graffitiLocal,
      graffitiRemote,
    );

    this.put = graffitiRemoteAndLocal.put;
    this.get = graffitiRemoteAndLocal.get;
    this.patch = graffitiRemoteAndLocal.patch;
    this.delete = graffitiRemoteAndLocal.delete;
    this.discover = graffitiRemoteAndLocal.discover;
    this.recoverOrphans = graffitiRemoteAndLocal.recoverOrphans;
    this.channelStats = graffitiRemoteAndLocal.channelStats;
  }

  protected useSessionManager() {
    if (!this.sessionManager) {
      this.sessionManager = (async () => {
        const { GraffitiSolidOIDCSessionManager } = await import(
          "@graffiti-garden/solid-oidc-session-manager"
        );
        return new GraffitiSolidOIDCSessionManager({
          ...this.sessionManagerOptions,
          sessionEvents: this.sessionEvents,
        });
      })();
    }
    return this.sessionManager;
  }

  async login(...args: Parameters<Graffiti["login"]>) {
    const sessionManager = await this.useSessionManager();
    return sessionManager.login(...args);
  }

  async logout(...args: Parameters<Graffiti["logout"]>) {
    const sessionManager = await this.useSessionManager();
    return sessionManager.logout(...args);
  }
}
