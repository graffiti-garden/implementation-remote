import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
  graffitiOrphanTests,
  graffitiChannelStatsTests,
} from "@graffiti-garden/api/tests";
import { GraffitiSingleServer } from "./database";
import secrets from "../../.secrets.json";
import { solidNodeLogin } from "@graffiti-garden/implementation-remote-common";

const source = "http://localhost:3000";

const session1 = solidNodeLogin(secrets);
const session2 = solidNodeLogin(secrets, 1);

graffitiDiscoverTests(
  () => new GraffitiSingleServer({ source }),
  () => session1,
  () => session2,
);
graffitiCRUDTests(
  () => new GraffitiSingleServer({ source }),
  () => session1,
  () => session2,
);
graffitiOrphanTests(
  () => new GraffitiSingleServer({ source }),
  () => session1,
  () => session2,
);
graffitiChannelStatsTests(
  () => new GraffitiSingleServer({ source }),
  () => session1,
  () => session2,
);
