import { Graffiti } from "@graffiti-garden/api";
import { graffitiCRUDTests } from "@graffiti-garden/api/tests";
import { GraffitiRemoteCrud } from "./crud";
import secrets from "../../.secrets.json";
import Ajv from "ajv";
import { solidNodeLogin } from "@graffiti-garden/implementation-remote-common";

const ajv = new Ajv({ strict: false });

const session1 = solidNodeLogin(secrets);
const session2 = solidNodeLogin(secrets, 1);

const useGraffiti: () => Pick<
  Graffiti,
  "get" | "put" | "patch" | "delete"
> = () =>
  new GraffitiRemoteCrud(
    "graffiti:remote:http://localhost:3000",
    async () => ajv,
  );

graffitiCRUDTests(
  useGraffiti,
  () => session1,
  () => session2,
);
