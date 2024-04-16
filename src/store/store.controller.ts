import {
  Get,
  Put,
  Body,
  HttpException,
  HttpStatus,
  Response,
} from "@nestjs/common";
import { Controller } from "@nestjs/common";
import { DecodeParam } from "../params/decodeparam.decorator";
import { WebId } from "../params/webid.decorator";
import { Channels } from "../params/channels.decorator";
import { AccessControlList } from "../params/acl.decorator";
import { GraffitiObject } from "../schemas/object.schema";
import { StoreService } from "./store.service";
import { FastifyReply } from "fastify";

@Controller("store")
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Put("user/:webId/store/:name")
  async putObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @Body() object: any,
    @Channels() channels: string[],
    @AccessControlList() acl: string[] | undefined,
    @WebId() selfWebId: string | null,
  ) {
    if (!selfWebId) {
      throw new HttpException(
        "You must be authenticated",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (webId !== selfWebId) {
      throw new HttpException(
        "You can only store your own objects",
        HttpStatus.FORBIDDEN,
      );
    }

    // Create an instance of a GraffitiObject
    const graffitiObject = new GraffitiObject();
    graffitiObject.webId = webId;
    graffitiObject.name = name;
    graffitiObject.value = object;
    graffitiObject.channels = channels;
    graffitiObject.acl = acl;
    await this.storeService.putObject(graffitiObject);
  }

  @Get("user/:webId/store/:name")
  async getObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    const graffitiObject = await this.storeService.getObject(
      webId,
      name,
      selfWebId,
    );

    if (!graffitiObject) {
      throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    } else {
      if (selfWebId === webId) {
        response.header("Access-Control-List", graffitiObject.acl);
        response.header("Channels", graffitiObject.channels);
      }
      return graffitiObject.value;
    }
  }
}
