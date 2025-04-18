import "dotenv/config";
import { Module } from "@nestjs/common";
import { StoreController } from "./store.controller";
import { StoreService } from "./store.service";
import type { GraffitiLocalOptions } from "@graffiti-garden/implementation-local/database";

const options: GraffitiLocalOptions = {};
const domain = process.env.DOMAIN;
if (domain) {
  options.origin = `graffiti:remote:${domain}`;
  console.log("Setting pod source to be ", options.origin);
}
if (process.env.USE_COUCHDB === "true") {
  console.log("Using external couchDB database...");
  const user = process.env.COUCHDB_USER;
  const password = process.env.COUCHDB_PASSWORD;
  options.pouchDBOptions = {
    name: `http://${user}:${password}@couchdb:5984/graffiti`,
  };
} else {
  console.log("Using internal pouchDB database...");
}

@Module({
  controllers: [StoreController],
  exports: [StoreService],
  providers: [
    StoreService,
    {
      provide: "GRAFFITI_POUCHDB_OPTIONS",
      useValue: options,
    },
  ],
})
export class StoreModule {}
