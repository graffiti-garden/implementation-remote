import {
  Get,
  Put,
  Delete,
  Patch,
  Body,
  Response,
  Header,
  UnprocessableEntityException,
  Inject,
  Optional,
  UnauthorizedException,
  Post,
  Param,
  Query,
} from "@nestjs/common";
import { Controller } from "@nestjs/common";
import { DecodeParam } from "../params/decodeparam.decorator";
import { Actor } from "../params/actor.decorator";
import { Channels } from "../params/channels.decorator";
import { Allowed } from "../params/allowed.decorator";
import type { FastifyReply } from "fastify";
import { Schema } from "../params/schema.decorator";
import { StoreService } from "./store.service";
import type {
  Graffiti,
  GraffitiObjectBase,
  GraffitiObjectStream,
  GraffitiObjectStreamContinue,
  GraffitiPatch,
} from "@graffiti-garden/api";
import {
  GraffitiLocalDatabase,
  type GraffitiLocalOptions,
} from "@graffiti-garden/implementation-local/database";

const CONTENT_TYPE = [
  "Content-Type",
  "application/json; charset=utf-8",
] as const;

@Controller()
export class StoreController {
  readonly graffiti: GraffitiLocalDatabase;
  readonly origin: string;

  constructor(
    private readonly storeService: StoreService,
    @Optional()
    @Inject("GRAFFITI_POUCHDB_OPTIONS")
    private readonly options?: GraffitiLocalOptions,
  ) {
    this.origin =
      this.options?.origin ?? "graffiti:remote:http://localhost:3000";
    options = {
      ...options,
      origin: this.origin,
    };
    this.graffiti = new GraffitiLocalDatabase(options);
  }

  @Get("discover")
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async discover(
    @Actor() actor: string | null,
    @Channels() channels: string[],
    @Response({ passthrough: true }) response: FastifyReply,
    @Schema() schema: {},
  ) {
    let iterator: GraffitiObjectStream<{}>;
    try {
      iterator = this.graffiti.discover<{}>(
        channels,
        schema,
        actor ? { actor } : undefined,
      );
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.iteratorToStreamableFile(iterator, response);
  }

  @Get("channel-stats")
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async channelStats(
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    if (!actor) {
      throw new UnauthorizedException(
        "You must be logged in to look up your channel statistics",
      );
    }
    let iterator: ReturnType<Graffiti["channelStats"]>;
    try {
      iterator = this.graffiti.channelStats({ actor });
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.iteratorToStreamableFile(iterator, response);
  }

  @Get("recover-orphans")
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async recoverOrphans(
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
    @Schema() schema: {},
  ) {
    if (!actor) {
      throw new UnauthorizedException(
        "You must be logged in to recover your orpaned objects",
      );
    }
    let iterator: GraffitiObjectStream<{}>;
    try {
      iterator = this.graffiti.recoverOrphans<{}>(schema, { actor });
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.iteratorToStreamableFile(iterator, response);
  }

  @Get("continue")
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async continueObjectStream(
    @Query("cursor") cursor: string | null,
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    if (!cursor) {
      throw new UnprocessableEntityException("Cursor is required");
    }
    let iterator: GraffitiObjectStreamContinue<{}>;
    try {
      iterator = this.graffiti.continueObjectStream(
        cursor,
        actor ? { actor } : undefined,
      );
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.iteratorToStreamableFile(iterator, response);
  }

  @Post("create")
  @Header(...CONTENT_TYPE)
  async create(
    @Body() value: unknown,
    @Channels() channels: string[],
    @Allowed() allowed: string[] | undefined,
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.requireActor(actor);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new UnprocessableEntityException("Body must be a JSON object");
    }

    let putted: GraffitiObjectBase;
    try {
      putted = await this.graffiti.put(
        {
          channels,
          allowed,
          value,
        },
        { actor },
      );
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.returnObject(putted, response, "create");
  }

  @Put(":name")
  @Header(...CONTENT_TYPE)
  async put(
    @DecodeParam("name") name: string,
    @Body() value: unknown,
    @Channels() channels: string[],
    @Allowed() allowed: string[] | undefined,
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.requireActor(actor);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new UnprocessableEntityException("Body must be a JSON object");
    }

    let putted: GraffitiObjectBase;
    try {
      putted = await this.graffiti.put(
        {
          actor,
          channels,
          allowed,
          value,
          url: this.origin + "/" + name,
        },
        { actor },
      );
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.returnObject(putted, response, "put");
  }

  @Delete(":name")
  @Header(...CONTENT_TYPE)
  async delete(
    @DecodeParam("name") name: string,
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.requireActor(actor);
    let deleted: GraffitiObjectBase;
    try {
      deleted = await this.graffiti.delete(this.origin + "/" + name, { actor });
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(deleted, response, "delete");
  }

  @Patch(":name")
  @Header(...CONTENT_TYPE)
  async patch(
    @DecodeParam("name") name: string,
    @Body() valuePatch: unknown,
    @Channels() channelsPatchStringArray: string[],
    @Allowed() allowedPatchStringArray: string[] | undefined,
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.requireActor(actor);

    const patches: GraffitiPatch = {};
    if (valuePatch) {
      if (Array.isArray(valuePatch)) {
        patches.value = valuePatch;
      } else {
        throw new UnprocessableEntityException("Value patch is not an array");
      }
    }
    for (const [key, patchStringArray] of [
      ["channels", channelsPatchStringArray],
      ["allowed", allowedPatchStringArray],
    ] as const) {
      try {
        patches[key] = patchStringArray?.map((patchString) =>
          JSON.parse(patchString),
        );
      } catch {
        throw new UnprocessableEntityException(`Invalid ${key} patch`);
      }
    }

    let patched: GraffitiObjectBase;
    try {
      patched = await this.graffiti.patch(patches, this.origin + "/" + name, {
        actor,
      });
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(patched, response, "patch");
  }

  @Get(":name")
  @Header(...CONTENT_TYPE)
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async get(
    @DecodeParam("name") name: string,
    @Actor() actor: string | null,
    @Schema() schema: {},
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    let gotten: GraffitiObjectBase;
    try {
      gotten = await this.graffiti.get(
        this.origin + "/" + name,
        schema,
        actor ? { actor } : undefined,
      );
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(gotten, response, "get");
  }
}
