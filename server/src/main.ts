import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

const headers = [
  "Content-Type",
  "Authorization",
  "DPoP",
  "Allowed",
  "Channels",
  "Last-Modified",
  "Last-Modified-Ms",
  "Cache-Control",
  "Vary",
  "Actor",
  "Location"
];

async function bootstrap() {
  const fastify = new FastifyAdapter({
    bodyLimit: 8 * 1024 * 1024,
  });
  fastify.enableCors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    allowedHeaders: headers,
    exposedHeaders: headers,
    maxAge: 3600, // 1 hour
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastify,
  );
  await app.listen(3000, "0.0.0.0");
}
bootstrap();
