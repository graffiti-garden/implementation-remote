import { Test, TestingModule } from "@nestjs/testing";
import {
  type NestFastifyApplication,
  FastifyAdapter,
} from "@nestjs/platform-fastify";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  assert,
} from "vitest";
import { randomBase64 as randomString } from "@graffiti-garden/implementation-local/utilities";
import secrets from "../../../.secrets.json";
import { solidNodeLogin } from "@graffiti-garden/implementation-remote-common";
import { StoreModule } from "./store.module";
import { encodeURIArray } from "../params/params.utils";
import type { GraffitiPatch } from "@graffiti-garden/api";

describe("StoreController", () => {
  let app: NestFastifyApplication;
  let solidFetch: typeof fetch;
  const port = 3000;
  const baseUrl = `http://localhost:${port}`;

  function toUrl(name: string) {
    return `${baseUrl}/${encodeURIComponent(name)}`;
  }

  async function request(
    fetch_: typeof fetch,
    url: string,
    method: string,
    options?: {
      body?: any;
      schema?: any;
      channels?: string[];
      allowed?: string[];
    },
  ) {
    url += "?";
    const headers = new Headers();
    const init: RequestInit = { method, headers };
    if (options?.body) {
      headers.set("Content-Type", "application/json");
      init.body = JSON.stringify(options.body);
    }
    if (options?.channels) {
      url += "channels=" + encodeURIArray(options.channels) + "&";
    }
    if (options?.allowed) {
      url += "allowed=" + encodeURIArray(options.allowed) + "&";
    }
    if (options?.schema) {
      url +=
        "schema=" + encodeURIComponent(JSON.stringify(options.schema)) + "&";
    }
    return await fetch_(url, init);
  }

  async function create(options: {
    value: {};
    channels?: string[];
    allowed?: string[];
  }) {
    const { value, channels, allowed } = options;
    const response = await request(solidFetch, toUrl("create"), "POST", {
      allowed,
      channels,
      body: value,
    });
    expect(response.status).toBe(201);
    const urlEncoded = response.headers.get("location");
    assert(urlEncoded, "location not provided");
    const graffitiUrl = decodeURIComponent(urlEncoded);
    const out = {
      graffitiUrl,
      url: graffitiUrl.slice("graffiti:remote:".length),
      response,
    };
    return out;
  }

  beforeAll(async () => {
    // Login to solid
    const session = await solidNodeLogin(secrets);
    solidFetch = session.fetch;
  }, 100000);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [StoreModule],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.listen(3000);
  }, 100000);

  afterEach(async () => {
    await app.close();
  }, 100000);

  it("put with normal fetch", async () => {
    const response = await fetch(toUrl("create"), {
      method: "POST",
    });
    expect(response.status).toBe(401);
  });

  it("get non-existant", async () => {
    const response = await fetch(toUrl(randomString()));
    expect(response.status).toBe(404);
  });

  it("put and get", async () => {
    const body = { [randomString()]: randomString(), "🪿": "🐣" };
    const channels = [randomString(), "://,🎨", randomString()];
    const dateBefore = new Date().toUTCString();
    const { url } = await create({ value: body, channels });
    const dateAfter = new Date().toUTCString();

    // Fetch authenticated
    const responseGetAuth = await solidFetch(url);
    expect(responseGetAuth.status).toBe(200);
    expect(responseGetAuth.headers.get("allowed")).toBeNull();
    expect(responseGetAuth.headers.get("channels")).toBe(
      encodeURIArray(channels),
    );
    expect(responseGetAuth.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    const lastModifiedAuth = responseGetAuth.headers.get(
      "last-modified",
    ) as string;
    expect(new Date(lastModifiedAuth).getTime()).toBeGreaterThanOrEqual(
      new Date(dateBefore).getTime(),
    );
    expect(new Date(lastModifiedAuth).getTime()).toBeLessThanOrEqual(
      new Date(dateAfter).getTime(),
    );
    await expect(responseGetAuth.json()).resolves.toEqual(body);

    // Fetch unauthenticated
    const responseGetUnauth = await fetch(url);
    expect(responseGetUnauth.status).toBe(200);
    await expect(responseGetUnauth.json()).resolves.toEqual(body);
    expect(responseGetUnauth.headers.get("access-control-list")).toBeNull();
    expect(responseGetUnauth.headers.get("channels")).toBeNull();
    expect(responseGetUnauth.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    const lastModifiedUnauth = responseGetAuth.headers.get(
      "last-modified",
    ) as string;
    expect(new Date(lastModifiedUnauth).getTime()).toBeGreaterThanOrEqual(
      new Date(dateBefore).getTime(),
    );
    expect(new Date(lastModifiedUnauth).getTime()).toBeLessThanOrEqual(
      new Date(dateAfter).getTime(),
    );
  });

  it("put and get unauthorized", async () => {
    const allowed = [randomString()];
    const channels = [randomString()];
    const { url } = await create({ value: {}, channels, allowed });

    const responseAuth = await solidFetch(url);
    expect(responseAuth.status).toBe(200);
    expect(responseAuth.headers.get("allowed")).toBe(encodeURIArray(allowed));
    expect(responseAuth.headers.get("channels")).toBe(encodeURIArray(channels));

    const responseUnauth = await fetch(url);
    expect(responseUnauth.status).toBe(404);
    expect(responseUnauth.headers.get("last-modified")).toBeNull();
    expect(responseUnauth.headers.get("channels")).toBeNull();
    expect(responseUnauth.headers.get("allowed")).toBeNull();
  });

  it("put invalid body", async () => {
    const response = await request(solidFetch, toUrl("create"), "POST", {
      body: [],
    });
    expect(response.status).toBe(422);
  });

  it("patch nonexistant", async () => {
    const response = await request(solidFetch, toUrl(randomString()), "PATCH", {
      body: [],
    });
    expect(response.status).toBe(404);
  });

  it("patch", async () => {
    const { url } = await create({
      value: {
        before: "something",
      },
    });

    const response = await request(solidFetch, url, "PATCH", {
      body: [
        { op: "remove", path: "/before" },
        { op: "add", path: "/hello", value: "world" },
      ] as GraffitiPatch["value"],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("channels")).toBeNull();
    expect(response.headers.get("allowed")).toBeNull();
    await expect(response.json()).resolves.toEqual({ before: "something" });

    const getResponse = await fetch(url);
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("channels")).toBeNull();
    expect(getResponse.headers.get("allowed")).toBeNull();
    await expect(getResponse.json()).resolves.toEqual({ hello: "world" });
  });

  it("try to patch to invalid", async () => {
    const { url } = await create({
      value: {
        hello: "world",
      },
    });

    const response = await request(solidFetch, url, "PATCH", {
      body: [
        { op: "remove", path: "/hello" },
        // Try to make it an array
        { op: "add", path: "", value: ["hello", "world"] },
      ] as GraffitiPatch["value"],
    });
    expect(response.status).toBe(422);
  });

  it("bad patch operation", async () => {
    const { url } = await create({
      value: {
        hello: "world",
      },
    });
    const response = await request(solidFetch, url, "PATCH", {
      body: [{ op: "notarealop", path: "/hello" }],
    });
    expect(response.status).toBe(422);
  });

  it("bad patch overall", async () => {
    const { url } = await create({
      value: {},
    });
    const response = await request(solidFetch, url, "PATCH", {
      body: { notanarray: true },
    });
    expect(response.status).toBe(422);
  });

  it("patch channels and acl", async () => {
    const { url } = await create({
      value: {},
    });
    const response = await request(solidFetch, url, "PATCH", {
      allowed: [
        JSON.stringify({
          op: "add",
          path: "",
          value: ["some-acl"],
        }),
      ],
      channels: [
        JSON.stringify({
          op: "add",
          path: "/-",
          value: "some-channel",
        }),
      ],
    });
    expect(response.status).toBe(200);
    const patched = await solidFetch(url);
    expect(patched.status).toBe(200);
    expect(patched.headers.get("channels")).toBe("some-channel");
    expect(patched.headers.get("allowed")).toBe("some-acl");
  });

  it("delete non-existant", async () => {
    const response = await request(solidFetch, toUrl(randomString()), "DELETE");
    expect(response.status).toBe(404);
  });

  it("put, delete, get", async () => {
    const body = { [randomString()]: randomString() };
    const { url } = await create({
      value: body,
    });
    const responseDelete = await request(solidFetch, url, "DELETE");
    expect(responseDelete.status).toBe(200);
    expect(await responseDelete.json()).toEqual(body);

    const responseGet = await fetch(url);
    expect(responseGet.status).toBe(404);
    // expect(responseGet.headers.get("last-modified")).toEqual(
    //   responseDelete.headers.get("last-modified"),
    // );
    // expect(responseGet.headers.get("last-modified-ms")).toEqual(
    //   responseDelete.headers.get("last-modified-ms"),
    // );
  });

  it("discover empty", async () => {
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels: [],
    });
    expect(response.status).toBe(200);
    const output = await response.text();
    const out = JSON.parse(output);
    expect(out).toHaveProperty("cursor");
  });

  it("discover single", async () => {
    const value = { [randomString()]: randomString() };
    const channels = [randomString(), randomString()];
    await create({
      value,
      channels,
    });
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
    });
    expect(response.status).toBe(200);
    const output = await response.text();
    const parts = output.split("\n").map((p) => JSON.parse(p));
    expect(parts.length).toBe(2);
    expect(parts[0].object.value).toEqual(value);
    expect(parts[0].object.channels.sort()).toEqual(channels.sort());
    expect(parts[0].object.allowed).toBeUndefined();
    expect(parts[1]).toHaveProperty("cursor");
  });

  it("discover multiple", async () => {
    const value1 = { [randomString()]: randomString() + "alskdjfk\n\n\\n" };
    const value2 = { [randomString()]: randomString() + "\n😏" };
    const channels1 = [randomString(), randomString()];
    const channels2 = [randomString(), channels1[0]];
    const { graffitiUrl: uri1, response: putted1 } = await create({
      value: value1,
      channels: channels1,
    });
    const { graffitiUrl: uri2, response: putted2 } = await create({
      value: value2,
      channels: channels2,
    });

    const putted1Date = new Date(putted1.headers.get("last-modified")!);
    putted1Date.setUTCMilliseconds(
      Number(putted1.headers.get("last-modified-ms")!),
    );
    const putted2Date = new Date(putted2.headers.get("last-modified")!);
    putted2Date.setUTCMilliseconds(
      Number(putted2.headers.get("last-modified-ms")!),
    );

    expect(putted2Date.getTime()).toBeGreaterThan(putted1Date.getTime());

    const channels = [channels1[0]];
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
    });
    expect(response.status).toBe(200);
    const output = await response.text();
    const parts = output.split("\n");
    expect(parts.length).toBe(3);
    const values = parts.map((p) => JSON.parse(p));
    for (const value of values.slice(0, 2)) {
      expect(value.tombstone).toBeFalsy();
      const obj = value.object;
      expect(obj.allowed).toBeUndefined();
      if (obj.url === uri1) {
        expect(obj.value).toEqual(value1);
        expect(obj.channels.sort()).toEqual(channels1.sort());
        expect(obj.lastModified).toBe(putted1Date.getTime());
      } else if (obj.url === uri2) {
        expect(obj.value).toEqual(value2);
        expect(obj.channels.sort()).toEqual(channels2.sort());
        expect(obj.lastModified).toBe(putted2Date.getTime());
      } else {
        throw new Error("Unexpected object");
      }
    }
    expect(values[2]).toHaveProperty("cursor");
  });

  it("discover with bad schema", async () => {
    const response = await solidFetch(baseUrl + "/discover?schema=alskdjflk");
    expect(response.status).toBe(422);
  });

  it("discover with schema", async () => {
    const channels = [randomString(), randomString()];
    for (let i = 9; i >= 0; i--) {
      await create({
        value: { index: i },
        channels,
      });
    }

    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
      schema: {
        // JSON Schema query
        properties: {
          value: {
            properties: {
              index: {
                type: "number",
                minimum: 3,
                maximum: 8,
              },
              "random👻otherfield": {
                enum: ["👻", "👽", "`,\\\n,dkjs🤘"],
              },
            },
          },
        },
      },
    });

    expect(response.ok).toBe(true);
    const output = await response.text();
    const partsAll = output.split("\n").map((p) => JSON.parse(p));
    expect(partsAll.length).toBe(7);
    expect(partsAll[6]).toHaveProperty("cursor");
    const parts = partsAll.slice(0, 6);
    let index = 3;
    const partsSortedByIndex = parts.sort(
      (a, b) => a.object.value.index - b.object.value.index,
    );
    for (const part of partsSortedByIndex) {
      expect(part.object.value.index).toBe(index);
      index++;
    }
  });
});
