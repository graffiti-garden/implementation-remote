import { describe } from "vitest";
import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
  graffitiLocationTests,
  graffitiOrphanTests,
  graffitiChannelStatsTests,
} from "@graffiti-garden/api/tests";
import { GraffitiFederated } from "./index";
import secrets from "../../.secrets.json";
import { solidNodeLogin } from "@graffiti-garden/implementation-remote-common";
import { randomBase64 } from "@graffiti-garden/implementation-local/utilities";

const source = "http://localhost:3000";
const options = { remote: { source } };

const session1 = solidNodeLogin(secrets);
const session2 = solidNodeLogin(secrets, 1);

describe("Remote sessions", () => {
  graffitiDiscoverTests(
    () => new GraffitiFederated(options),
    () => session1,
    () => session2,
  );
  graffitiCRUDTests(
    () => new GraffitiFederated(options),
    () => session1,
    () => session2,
  );
  graffitiLocationTests(() => new GraffitiFederated(options));
  graffitiOrphanTests(
    () => new GraffitiFederated(options),
    () => session1,
    () => session2,
  );
  graffitiChannelStatsTests(
    () => new GraffitiFederated(options),
    () => session1,
    () => session2,
  );
});

// Local tests as well
describe("Local sessions", () => {
  graffitiDiscoverTests(
    () => new GraffitiFederated(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
  graffitiCRUDTests(
    () => new GraffitiFederated(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
  graffitiOrphanTests(
    () => new GraffitiFederated(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
  graffitiChannelStatsTests(
    () => new GraffitiFederated(options),
    () => session1,
    () => session2,
  );
});
