# Starless server

All in one, minimalist web server for <b>spa, express, lambda, azure function, graphql and socket.io</b>.

## Installation

If this is a brand new project, make sure to create a package.json first with the npm init command.

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

```
"scripts": {
  "start": "starless-server start",
  "build": "starless-server build --azure-functions --aws-lambda"
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

```
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

```
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

```
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
```
module.exports = (req, res) => {
  res.json({ message: "hello from express" });
};
```

> <b>Note</b> building express style function to lambda and azure function is not supported.

## Dynamic Routes

starless-server supports express dynamic routes. For example, if you create a file called `routes/posts/:id.js`, then it will be accessible at `posts/1`, `posts/2`, etc.

```
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

> <b>Note</b> You should not use dynamic routes with lambda and azure function. Building dynamic route lambda and azure function is not supported.


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

## GraphQL API

starless-server can be used as GraphQL API server. 

Create `graphql` directory at the root of your application and then create two files `schema.gql` and `root.js` at `graphql` directory.

- `schema.gql` - Construct a schema, using GraphQL schema language
- `root.js` - The root provides a resolver function for each API endpoint

Populate `graphql/schema.gql` with the following contents:
```
type Query {
  hello: String
}
```

Populate `graphql/root.js` with the following contents:
```
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

starless-server has build in support for `socket.io`. In starless-server, an event is a function exported from a `.js` file in the events directory. Each event is associated with its file name. If you create `events/chat.js`, it will listen at `chat` event.

Create `events` directory at the root of your application. 

Example `events/chat.js`
```
module.exports = (io, socket) => (anotherSocketId, msg) => {
  socket.to(anotherSocketId).emit("chat", socket.id, msg);
};
```
