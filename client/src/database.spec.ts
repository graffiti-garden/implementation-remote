import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
  graffitiOrphanTests,
  graffitiChannelStatsTests,
} from "@graffiti-garden/api/tests";
import { GraffitiRemoteDatabase } from "./database";
import secrets from "../../.secrets.json";
import { solidNodeLogin } from "@graffiti-garden/implementation-remote-common";

const origin = "graffiti:remote:http://localhost:3000";

const session1 = solidNodeLogin(secrets);
const session2 = solidNodeLogin(secrets, 1);

graffitiDiscoverTests(
  () => new GraffitiRemoteDatabase({ origin }),
  () => session1,
  () => session2,
);
graffitiCRUDTests(
  () => new GraffitiRemoteDatabase({ origin }),
  () => session1,
  () => session2,
);
graffitiOrphanTests(
  () => new GraffitiRemoteDatabase({ origin }),
  () => session1,
  () => session2,
);
graffitiChannelStatsTests(
  () => new GraffitiRemoteDatabase({ origin }),
  () => session1,
  () => session2,
);
