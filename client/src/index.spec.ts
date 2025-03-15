import { describe } from "vitest";
import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
  graffitiOrphanTests,
  graffitiChannelStatsTests,
} from "@graffiti-garden/api/tests";
import { GraffitiRemote } from "./index";
import secrets from "../../.secrets.json";
import { solidNodeLogin } from "@graffiti-garden/implementation-remote-common";
import { randomBase64 } from "@graffiti-garden/implementation-local/utilities";

const origin = "graffiti:remote:http://localhost:3000";
const options = { remote: { origin } };

const session1 = solidNodeLogin(secrets);
const session2 = solidNodeLogin(secrets, 1);

describe("Remote sessions", () => {
  graffitiDiscoverTests(
    () => new GraffitiRemote(options),
    () => session1,
    () => session2,
  );
  graffitiCRUDTests(
    () => new GraffitiRemote(options),
    () => session1,
    () => session2,
  );
  graffitiOrphanTests(
    () => new GraffitiRemote(options),
    () => session1,
    () => session2,
  );
  graffitiChannelStatsTests(
    () => new GraffitiRemote(options),
    () => session1,
    () => session2,
  );
});

// Local tests as well
describe("Local sessions", () => {
  graffitiDiscoverTests(
    () => new GraffitiRemote(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
  graffitiCRUDTests(
    () => new GraffitiRemote(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
  graffitiOrphanTests(
    () => new GraffitiRemote(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
  graffitiChannelStatsTests(
    () => new GraffitiRemote(options),
    () => session1,
    () => session2,
  );
});
