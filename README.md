# Starless Server

All in one, minimalist web server for <b>spa, express, lambda, azure function, graphql and socket.io</b>.

## Installation

If this is a brand new project, make sure to create a package.json first with the `npm init` command.

Installation is done using the npm install command:

```
npm install starless-server
```

## Quick Start

Install starless-server in your project.

```
npm install starless-server
```

Open package.json and add the following scripts:

```json
"scripts": {
  "start": "starless-server start",
  "build": "starless-server build --azure-functions --aws-lambda --aws-sam-lambda"
}
```

- `start` - Runs `starless-server start` to start a production server
- `build` - Bundles app for azure-functions and lambda
  > [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools) is required for building azure-functions

Create two directories `routes` and `public` at the root of your application:

- routes - Associated with a route based on their file name. For example `routes/posts.js` is mapped to `/posts`
- public - Stores static assets such as images, fonts, etc.

Inside the routes directory add the `posts.js` file to get started. This is the route that is handled when the user request `/posts`.

Populate `routes/posts.js` with the following contents:

```js
const posts = [
  {
    id: 1,
    title:
      "Can't Stop Thinking About Her? Here's Why You Need to Meet More Girls",
    description: "lorem ipsum",
    content:
      "You know that feeling. There's this girl you've been chasing forever.
      You positively, absolutely, can't stop thinking about her. She's the most amazing woman in the world
      -- you're certain of it. There's never been another one like her.",
  },
];

module.exports = (req, res) => {
  res.json({
    code: 200,
    message: "Fetched posts successful.",
    data: posts,
  });
};
```

After the set up is complete:

- Run `npm start` to start the production server on http://localhost:3000
- Visit http://localhost:3000/posts to view your posts

## Routes

In starless-server, a route is a function exported from a `.js` file in the routes directory. Each route is associated with a route based on its file name. If you create `routes/comments.js`, it will be accessible at `/comments`.

Three types of function can be used in routes directory.

- Azure Function

```js
const httpTrigger = async function (context, req) {
  context.log("HTTP trigger function processed a request.");
  context.res = {
    body: {
      message: "hello from azure function",
    },
  };
};
module.exports = httpTrigger;
```

- Lambda

```js
const handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "hello from lambda",
    }),
  };
};
exports.handler = handler;
```

- Express

```js
module.exports = (req, res) => {
  res.json({ message: "hello from express" });
};
```

> <b>Note</b> Express next middleware function is not supported in serverless functions.

Express router is also supported because it internally used express middleware.

```js
const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "hello from express router" });
});

module.exports = router;
```

## Dynamic Routes

starless-server supports express dynamic routes. For example, if you create a file called `routes/posts/[id].js`, then it will be accessible at `posts/1`, `posts/2`, etc.

```js
const posts = [
  {
    id: 1,
    title:
      "Can't Stop Thinking About Her? Here's Why You Need to Meet More Girls",
    description: "lorem ipsum",
    content:
      "You know that feeling. There's this girl you've been chasing forever.
      You positively, absolutely, can't stop thinking about her. She's the most amazing woman in the world
      -- you're certain of it. There's never been another one like her.",
  },
];

module.exports = (req, res) => {
  const post = posts.find((p) => (p.id = req.params.id));

  if (!post) {
    return res.status(404).json({
      code: 404,
      message: "Post not found!",
    });
  }

  res.json({
    code: 200,
    message: "Fetched post successful.",
    data: post,
  });
};
```

## Static File Serving

starless-server can serve static files, like images, under a folder called `public` in the root directory. Files inside public can then be requested by your browser starting from the base URL `/`.

## Serving Single Page Application

You don’t necessarily need a separate static server in order to run a SPA project in production. Place SPA `build` folder in the root directory and rename it to `dist`. starless-server will look for `index.html` under `dist` directory. If your `index.html` is not at the root of `dist` directory, you can change it from `.env` with `spa_path=dist/somefolder`.

## Environment Variables

starless-server has built-in support for loading environment variables from `.env` into `process.env`.

```
port=3001
spa_path=dist/authentication
graphql_path=/api/graphql
request_body_size=1000kb
```

## Worker Process

If you want to run multiple instances of server that can distribute workloads among their application threads, you can add `worker_processes` in environment.

```
...
worker_processes=4
...
```

> <b>Note</b> Default `worker_processes` count is 1. If `auto` is set, server will set all available cpus count.

## SSL Certificate

If you want to add SSL certificate, you can set certificate file path in `ssl_key` and `ssl_cert` in environment.

```
...
ssl_key=~/cert/key.pem
ssl_cert=~/cert/cert.pem
...
```

## GraphQL API

starless-server can be used as GraphQL API server.

Create `graphql` directory at the root of your application and then create two files `schema.gql` and `root.js` at `graphql` directory.

- `schema.gql` - Construct a schema, using GraphQL schema language
- `root.js` - The root provides a resolver function for each API endpoint

Populate `graphql/schema.gql` with the following contents:

```gql
type Query {
  hello: String
}
```

Populate `graphql/root.js` with the following contents:

```js
module.exports = {
  hello: () => {
    return "Hello world!";
  },
};
```

After the set up is complete:

- Run `npm start` to start the GraphQL API server on http://localhost:3000/graphql
- Visit http://localhost:3000/graphql to see an interface that lets you enter queries

## Socket.IO

starless-server has build in support for `socket.io`. In starless-server, an event is a function exported from a `.js` file in the `events` directory. Each event is associated with its file name. If you create `events/chat.js`, it will listen at `chat` event.

Create `events` directory at the root of your application.

Example `events/chat.js`

```js
module.exports = (io, socket) => (anotherSocketId, msg) => {
  socket.to(anotherSocketId).emit("chat", socket.id, msg);
};
```

## PeerServer

starless-server has build in support for `peerjs`. To listen for peer connection you must add `peer_connection` environment to `on` in `.env` file.

```
peer_connection=on
```

After starting the server, open the browser and check http://localhost:3000/peerjs/

## Hooks

If you want to run some scripts before or after server start, create `hooks.js` at the root of your application.

There are eight life cycle hooks

- beforeServerStart - Run before server start
- afterServerStart - Run after server start
- afterMasterProcessStart - Run after primary process start
- afterWorkerStart - Run after worker start
- errorHandler - Express error handler
- afterPeerConnected - Run after peer connects to the server
- afterPeerDisconnected - Run after peer disconnects from the server
- afterSocketIOStart - Run after socketio server start
- afterSocketConnected - Run after socket connected

```js
exports.beforeServerStart = (app) => {
  console.log("Before server start.");
};

exports.afterServerStart = (server) => {
  console.log("After server start.");
};

exports.afterMasterProcessStart = (cluster) => {
  console.log("After master process start.");
};

exports.afterWorkerStart = (cluster) => {
  console.log("After worker start.)
}

exports.errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message });
};

exports.afterPeerConnected = (client) => {
  console.log("After peer connected.");
};

exports.afterPeerDisconnected = (client) => {
  console.log("After peer disconnected.");
};

exports.afterSocketIOStart = (client) => {
  console.log("After socketio start.");
};

exports.afterSocketConnected = (io, socket) => {
  console.log('After socket connected.')
}
```

> <b>Note</b> Hooks are only works in starless-server. Do not use it for azure functions and lambda applications.

## Building Serverless Functions

In starless-server, you can write both Azure Functions and AWS Lambda. When you want to deploy those functions to lambda or azure-functions you don't need to worry about changing azure function code to lambda or lambda code to azure function vice versa. starless-server will automatically handle those heavy task for you when building.

Three options can be passed in build command:

- `--azure-functions` - build for azure-function
- `--aws-lambda` - build for lambda
- `--aws-sam-lambda` - build for sam lambda

Open package.json and add the build scripts:

```json
"scripts": {
  ...
  "build": "starless-server build --azure-functions --aws-lambda --aws-sam-lambda"
}
```

> [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools) is required for building azure-functions

Run `npm run build`. Two directories `azure_functions`, `aws_lambda` and `aws_sam_lambda` will created in your application root directory.

- For deploying azure function see more at [Azure Function](https://docs.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-node#deploy-the-project-to-azure)
- For lambda you must manually copy codes from aws_lambda directory and paste at lambda functions console. Files not from `routes` directory are placed and zipped in `layers/common/common.zip`. You must upload `common.zip` as lambda layer. See more at [Lambda Layers](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)

## Swagger

starless-server allows you to serve auto-generated swagger-ui generated API docs, based on a `swagger.json` file. Create `swagger.json` at the root of your application. If `swagger.json` is not existed, starless-server will auto generate blank `swagger.json` file.

## Config

If you want to change certain settings like cors or request body size or peer server options, create `config.js` at the root of your application.

```js
module.exports = {
  cors: {
    origin: "*", // default cors origin
  },
  bodyParser: {
    limit: "100kb", // default limit
  },
  peer: {
    path: "/",
  },
  rules: [
    {
      url: "/*",
      method: "get",
      cache: true,
    },
  ],
};
```
