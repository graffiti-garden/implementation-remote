import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
  graffitiOrphanTests,
  graffitiChannelStatsTests,
} from "@graffiti-garden/api/tests";
import { GraffitiMultipleRemoteDatabases } from "./multiple-databases";
import secrets from "../../.secrets.json";
import { solidNodeLogin } from "@graffiti-garden/implementation-remote-common";

const registry = ["graffiti:remote:http://localhost:3000"];

const session1 = solidNodeLogin(secrets);
const session2 = solidNodeLogin(secrets, 1);

graffitiDiscoverTests(
  () => new GraffitiMultipleRemoteDatabases({ registry }),
  () => session1,
  () => session2,
);
graffitiCRUDTests(
  () => new GraffitiMultipleRemoteDatabases({ registry }),
  () => session1,
  () => session2,
);
graffitiOrphanTests(
  () => new GraffitiMultipleRemoteDatabases({ registry }),
  () => session1,
  () => session2,
);
graffitiChannelStatsTests(
  () => new GraffitiMultipleRemoteDatabases({ registry }),
  () => session1,
  () => session2,
);
