import { Graffiti } from "@graffiti-garden/api";
import {
  GraffitiLocalDatabase,
  type GraffitiLocalOptions,
} from "@graffiti-garden/implementation-local/database";
import {
  type GraffitiSolidOIDCSessionManagerOptions,
  GraffitiSolidOIDCSessionManager,
} from "@graffiti-garden/solid-oidc-session-manager";
import { GraffitiRemoteDatabase } from "./database";
import { GraffitiRemoteAndLocal } from "./remote-and-local";
import type { GraffitiRemoteOptions } from "./types";

export type * from "./types";

export class GraffitiRemote extends Graffiti {
  put: Graffiti["put"];
  get: Graffiti["get"];
  patch: Graffiti["patch"];
  delete: Graffiti["delete"];
  discover: Graffiti["discover"];
  recoverOrphans: Graffiti["recoverOrphans"];
  channelStats: Graffiti["channelStats"];
  continueObjectStream: Graffiti["continueObjectStream"];
  login: Graffiti["login"];
  logout: Graffiti["logout"];
  sessionEvents: Graffiti["sessionEvents"];

  /**
   * Create a new Graffiti client that can interact with a federated set of pods.
   */
  constructor(options?: {
    local?: GraffitiLocalOptions;
    remote?: GraffitiRemoteOptions;
    session?: GraffitiSolidOIDCSessionManagerOptions;
  }) {
    super();

    const sessionManager = new GraffitiSolidOIDCSessionManager(
      options?.session,
    );
    this.login = sessionManager.login.bind(sessionManager);
    this.logout = sessionManager.logout.bind(sessionManager);
    this.sessionEvents = sessionManager.sessionEvents;

    const graffitiLocal = new GraffitiLocalDatabase(options?.local);
    const graffitiRemote = new GraffitiRemoteDatabase(
      options?.remote ?? {
        origin: "graffiti:remote:pod.graffiti.garden",
      },
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
    this.continueObjectStream = graffitiRemoteAndLocal.continueObjectStream;
  }
}
