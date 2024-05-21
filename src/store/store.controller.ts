import {
  Get,
  Put,
  Delete,
  Patch,
  Body,
  Response,
  Header,
  BadRequestException,
} from "@nestjs/common";
import { Controller } from "@nestjs/common";
import { DecodeParam } from "../params/decodeparam.decorator";
import { WebId } from "../params/webid.decorator";
import { Channels } from "../params/channels.decorator";
import { AccessControlList } from "../params/acl.decorator";
import { StoreSchema } from "./store.schema";
import { StoreService } from "./store.service";
import { FastifyReply } from "fastify";
import { Operation } from "fast-json-patch";

const CONTENT_TYPE = [
  "Content-Type",
  "application/json; charset=utf-8",
] as const;

@Controller(":webId/:name")
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Header(...CONTENT_TYPE)
  @Put()
  async putObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @Body() value: any,
    @Channels() channels: string[],
    @AccessControlList() acl: string[] | undefined,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateWebId(webId, selfWebId);

    // Create an instance of a GraffitiObject
    const object = new StoreSchema();
    object.webId = webId;
    object.name = name;
    object.value = value;
    object.channels = channels;
    object.acl = acl;

    const putted = await this.storeService.putObject(object);
    return this.storeService.returnObject(putted, selfWebId, response, true);
  }

  @Header(...CONTENT_TYPE)
  @Delete()
  async deleteObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateWebId(webId, selfWebId);
    const deleted = await this.storeService.deleteObject(webId, name);
    return this.storeService.returnObject(deleted, selfWebId, response);
  }

  @Header(...CONTENT_TYPE)
  @Patch()
  async patchObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @Body() valuePatch: any,
    @Channels() channelsPatchStringArray: string[],
    @AccessControlList() aclPatchStringArray: string[] | undefined,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    if (!Array.isArray(valuePatch)) {
      throw new BadRequestException("Invalid value patch");
    }
    const patches: {
      value: Operation[];
      acl?: Operation[];
      channels?: Operation[];
    } = { value: valuePatch };
    for (const [key, patchStringArray] of [
      ["channels", channelsPatchStringArray],
      ["acl", aclPatchStringArray],
    ] as const) {
      try {
        patches[key] = patchStringArray?.map((patchString) =>
          JSON.parse(patchString),
        );
      } catch {
        throw new BadRequestException(`Invalid ${key} patch`);
      }
    }
    this.storeService.validateWebId(webId, selfWebId);
    const patched = await this.storeService.patchObject(webId, name, patches);
    return this.storeService.returnObject(patched, selfWebId, response);
  }

  @Header(...CONTENT_TYPE)
  @Get()
  async getObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    const gotten = await this.storeService.getObject(webId, name, selfWebId);
    return this.storeService.returnObject(gotten, selfWebId, response);
  }
}
