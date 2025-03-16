import { createSolidTokenVerifier } from "@solid/access-token-verifier";
import { WebIDIssuersCache } from "@solid/access-token-verifier/dist/class/WebIDIssuersCache";
import type {
  RequestMethod,
  SolidAccessTokenPayload,
  RetrieveOidcIssuersFunction,
} from "@solid/access-token-verifier";
import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { IncomingMessage } from "http";

class MyWebIdIssuersCache extends WebIDIssuersCache {
  public constructor(private readonly cache = new WebIDIssuersCache()) {
    super();
  }
  public async getIssuers(
    webid: string,
  ): ReturnType<RetrieveOidcIssuersFunction> {
    try {
      return await this.cache.getIssuers(webid);
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.startsWith("The WebID could not be parsed") &&
        webid.startsWith("https://id.inrupt.com")
      ) {
        return ["https://login.inrupt.com"];
      } else {
        throw new UnauthorizedException(
          `Could not retrieve OIDC issuers for ${webid}`,
        );
      }
    }
  }
}

const verify = createSolidTokenVerifier(
  undefined,
  undefined,
  new MyWebIdIssuersCache(),
);

export const Actor = createParamDecorator(
  async (_, ctx: ExecutionContext): Promise<string | null> => {
    const request = ctx.switchToHttp().getRequest() as IncomingMessage;

    const {
      url,
      socket,
      headers: { authorization, dpop, host },
    } = request;

    // An unauthenticated request
    if (!authorization || !dpop || typeof dpop !== "string") {
      return null;
    }

    const method = request.method as RequestMethod;
    const protocol =
      "x-forwarded-proto" in request.headers
        ? request.headers["x-forwarded-proto"]
        : "encrypted" in socket
          ? "https"
          : "http";
    const urlComplete = `${protocol}://${host}${url}`;

    let payload: SolidAccessTokenPayload;
    try {
      payload = await verify(authorization, {
        header: dpop,
        method,
        url: urlComplete,
      });
    } catch (e) {
      throw new UnauthorizedException(e);
    }

    return payload.webid;
  },
);
