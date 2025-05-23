# Graffiti Remote Implementation: Server

This is a server for a remote implementation of the [Graffiti API](https://api.graffiti.garden/classes/Graffiti.html).
The corresponding client is [adjacent in this repository](../client).

This server uses a [local Implementation](https://github.com/graffiti-garden/implementation-local)
of the Graffiti API under the hood, based on [PouchDB](https://pouchdb.com/),
but wraps the local implementation is wrapped with [Solid OIDC](https://solid.github.io/solid-oidc/) for portable authentication.

## Development

### Standalone Setup

Since this server uses [PouchDB](https://pouchdb.com/), it can be run both with or without a separate database.
For production, we will stand up a [CouchDB](https://couchdb.apache.org/) instance via docker,
but for development and testing, we can use either an in-memory database or a dockerized CouchDB instance.

To use the in-memory database, simply install the package locally by running the following in the
`server` directory:

```bash
npm install
```

### Dockerized Setup

To use the dockerized CouchDB instance, first install [Docker](https://docs.docker.com/engine/install/#server) and [Docker Compose](https://docs.docker.com/compose/install/).
Then create a `.env` file in the *root* of the repository (not the `server` directory)
with the following contents:

```bash
COUCHDB_USER=admin
COUCHDB_PASSWORD=password
```

For production, you should change the password to something more secure.

Then, run the following command (again in the *root* of the repository):

```bash
sudo docker compose up --build
```

Then in another terminal launch a shell in the root of the repository:

```bash
sudo docker compose exec graffiti-pod sh
```

Use this shell to run the commands listed below. When you are done, you can stop the container (in the original shell) with:

```bash
docker compose down --remove-orphans
```

### Running

Once setup (with either method), you can run the server.

```bash
npm start
```

The application will be up at [localhost:3000](http://localhost:3000).

See `package.json` for more scripts.

### Testing

Some of the tests require a Solid login, so in the root of the repository,
create a `.secrets.json` file containing a list of [static Solid login credentials](https://docs.inrupt.com/developer-tools/javascript/client-libraries/tutorial/authenticate-nodejs-script/#authenticate-with-statically-registered-client-credentials).

```json
[
  {
    "clientId": "12345..."
    "clientSecret": "67890..."
    "oidcIssuer": "https://login.inrupt.com"
    "refreshToken": "abcde... not provided by all providers"
  }
]
```

You can register for free credentials at [Inrupt](https://login.inrupt.com/registration.html).
Alternatively, you can use [@inrupt/generate-oidc-token](https://github.com/inrupt/generate-oidc-token)
however be warned that is has been deprecated and may not work in the future.

```bash
npx @inrupt/generate-oidc-token
```

Also, make sure the web server is not be running as it conflicts with tests, i.e. kill `npm start`.

Then run the following:

```bash
npm test
```

See `package.json` for more test scripts.
For example, you can watch for changes and test a particular file like the `store.controller` module:

```bash
npm run test:watch store.controller
```

## Deployment

Make sure the server has [Docker engine and compose](https://docs.docker.com/engine/install/#server) and [Certbot](https://certbot.eff.org/instructions) installed.

You will need two domains, one public domain for users to access the server
and one private domain for you to administer the database.
We will call these `DOMAIN` and `COUCHDB_DOMAIN` respectively.
Use your domain registrar to set up two A records each pointing to your server's IP.

Once you can ping `DOMAIN` and get your server's IP
(it can take up to an hour for DNS changes to propogate), run:

```bash
sudo certbot certonly --standalone -d DOMAIN -d COUCHDB_DOMAIN
```

Create a user-owned `/srv/docker` folder, `cd` into it and, clone this repository.

```bash
sudo mkdir /srv/docker
sudo chown -R $(whoami):$(whoami) /srv/docker
cd /srv/docker
git clone https://github.com/graffiti-garden/implementation-remote
```

In the root of the repository, create a `.env` file defining both
domains and the CouchDB credentials.

```bash
DOMAIN=pod.example.com
COUCHDB_DOMAIN=db.example.com
COUCHDB_USER=admin
COUCHDB_PASSWORD=password
```

Make sure to change the password to something more secure. However
currently special charachters won't work.
If you need to clear and change the password (not that this will
delete *all* your couchDB settings), run:

```bash
sudo docker volume rm implementation-remote_graffiti-couchdb-config
```

Finally, link the service file into `systemd` and enable it.

```bash
sudo ln -f server/config/system/graffiti-pod.service /etc/systemd/system/
sudo systemctl enable --now graffiti-pod.service
```

You can check on the status with

```bash
sudo systemctl status graffiti-pod.service
```

or restart with

```bash
sudo systemctl restart graffiti-pod.service
```
