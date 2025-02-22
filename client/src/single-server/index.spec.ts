import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
  graffitiOrphanTests,
  graffitiChannelStatsTests,
} from "@graffiti-garden/api/tests";
import { GraffitiSingleServer } from "./index";
import secrets from "../../../.secrets.json";
import Ajv from "ajv";
import { solidNodeLogin } from "@graffiti-garden/implementation-remote-common";

const ajv = new Ajv({ strict: false });

const source = "http://localhost:3000";

const session1 = solidNodeLogin(secrets);
const session2 = solidNodeLogin(secrets, 1);

graffitiDiscoverTests(
  () => new GraffitiSingleServer({ source }, ajv),
  () => session1,
  () => session2,
);
// graffitiCRUDTests(
//   () => new GraffitiSingleServer({ source }, ajv),
//   () => session1,
//   () => session2,
// );
// graffitiOrphanTests(
//   () => new GraffitiSingleServer({ source }, ajv),
//   () => session1,
//   () => session2,
// );
// graffitiChannelStatsTests(
//   () => new GraffitiSingleServer({ source }, ajv),
//   () => session1,
//   () => session2,
// );
