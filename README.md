# Starless server

All in one, minimalist web server for <b>spa, express, lambda, azure function, graphql and socket.io</b>.

## Installation

Before installing, download and install Node.js. Node.js 0.10 or higher is required.

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

- routes - Associated with a route based on their file name. For example routes/posts.js is mapped to /posts
- public - Stores static assets such as images, fonts, etc.

Inside the routes directory add the `posts.js` file to get started. This is the route that is handled when the user request `/posts`.

Populate `routes/posts.js` with the following contents:

```
module.exports = (req, res) => res.json({message: 'hello world'})
```
