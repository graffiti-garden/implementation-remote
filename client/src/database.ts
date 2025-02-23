import type Ajv from "ajv";
import type { Graffiti } from "@graffiti-garden/api";
import { GraffitiSingleServerCrud } from "./crud";
import { GraffitiSingleServerStreamers } from "./streamers";

export interface GraffitiSingleServerOptions {
  source: string;
  ajv?: Ajv;
}

export class GraffitiSingleServer
  implements
    Pick<
      Graffiti,
      | "put"
      | "get"
      | "patch"
      | "delete"
      | "discover"
      | "recoverOrphans"
      | "channelStats"
    >
{
  protected readonly crud: GraffitiSingleServerCrud;
  protected readonly streamers: GraffitiSingleServerStreamers;
  protected readonly options: GraffitiSingleServerOptions;
  protected ajv_: Promise<Ajv> | undefined;

  put: Graffiti["put"];
  get: Graffiti["get"];
  patch: Graffiti["patch"];
  delete: Graffiti["delete"];
  discover: Graffiti["discover"];
  recoverOrphans: Graffiti["recoverOrphans"];
  channelStats: Graffiti["channelStats"];

  get ajv() {
    if (!this.ajv_) {
      this.ajv_ = this.options.ajv
        ? Promise.resolve(this.options.ajv)
        : (async () => {
            const { default: Ajv } = await import("ajv");
            return new Ajv({ strict: false });
          })();
    }
    return this.ajv_;
  }

  constructor(options: GraffitiSingleServerOptions) {
    this.options = options;
    this.crud = new GraffitiSingleServerCrud(options.source, () => this.ajv);
    this.streamers = new GraffitiSingleServerStreamers(
      options.source,
      () => this.ajv,
    );

    this.put = this.crud.put.bind(this.crud);
    this.get = this.crud.get.bind(this.crud);
    this.patch = this.crud.patch.bind(this.crud);
    this.delete = this.crud.delete.bind(this.crud);
    this.discover = this.streamers.discover.bind(this.streamers);
    this.recoverOrphans = this.streamers.recoverOrphans.bind(this.streamers);
    this.channelStats = this.streamers.channelStats.bind(this.streamers);
  }
}
