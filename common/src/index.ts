import { Session } from "@inrupt/solid-client-authn-node";
import type { ILoginInputOptions } from "@inrupt/solid-client-authn-node";

export async function solidNodeLogin(
  secretsAll: ILoginInputOptions[],
  secretIndex: number = 0,
) {
  if (!Array.isArray(secretsAll)) {
    throw new Error("Secrets must be an array");
  }

  const secrets = secretsAll[secretIndex];
  if (!secrets) {
    throw new Error(`Secret ${secretIndex} not found`);
  }

  const session = new Session();
  await session.login(secrets);
  if (!session.info.isLoggedIn || !session.info.webId) {
    throw new Error("Could not log in");
  }
  return {
    fetch: session.fetch,
    actor: session.info.webId,
  };
}
