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
  "start": "starless-server",
  "build": "starless-server build --azure-functions --aws-lambda"
}
```

- `start` - Runs `starless-server` to start a production server
- `build` - Bundles app for azure-functions and lambda
> [Azure Functions Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Cmacos%2Ccsharp%2Cportal%2Cbash) is required for building azure-functions
