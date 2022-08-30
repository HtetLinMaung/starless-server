#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, Express } from "express";
import { graphqlHTTP } from "express-graphql";
import { buildSchema } from "graphql";
import { Server } from "socket.io";
import { APIGatewayProxyResult } from "aws-lambda";
import cors from "cors";
import path from "path";
import chalk from "chalk";
import fs from "fs";
import getFiles from "./utils/get-files";
import buildAzureFunction from "./build-azure-function";
import buildAwsLambda from "./build-aws-lambda";
import { isAsyncFunction } from "util/types";

const PORT = process.env.port || 3000;

const hooksFilePath = path.join(process.cwd(), "hooks.js");
const routesFolderPath = path.join(process.cwd(), "routes");
const graphqlFolderPath = path.join(process.cwd(), "graphql");
const eventsFolderPath = path.join(process.cwd(), "events");

const spaPath = path.join(process.cwd(), process.env.spa_path || "dist");

const initRoutes = async (app: Express, hooksModule: any = {}) => {
  if (
    fs.existsSync(graphqlFolderPath) &&
    fs.existsSync(path.join(graphqlFolderPath, "schema.gql"))
  ) {
    const schemaContents = fs.readFileSync(
      path.join(graphqlFolderPath, "schema.gql"),
      "utf8"
    );
    const module = await import(path.join(graphqlFolderPath, "root.js"));
    app.use(
      process.env.graphql_path || "/graphql",
      graphqlHTTP({
        schema: buildSchema(schemaContents),
        rootValue: module.default,
        graphiql: true,
      })
    );

    console.log(
      chalk.gray(
        `Running a GraphQL API server at http://localhost:${PORT}${
          process.env.graphql_path || "/graphql"
        }\n`
      )
    );
  }

  const routes = getFiles(routesFolderPath);
  if (routes.length) {
    console.log(chalk.yellow("Routes:\n"));
    for (const route of routes) {
      if (route.endsWith(".js")) {
        const path = route.replace(routesFolderPath, "").split(".")[0];

        console.log(
          `\t${chalk.yellow(
            path.split("/")[path.split("/").length - 1]
          )} ${chalk.green(
            "[GET,POST,PUT,PATCH,DELETE] http://localhost:" + PORT + path
          )}\n`
        );

        const module = await import(route);

        let expressHandler = null;
        if ("handler" in module) {
          const { handler } = module;
          expressHandler = async (req: Request, res: Response) => {
            const event = {
              path: req.path,
              httpMethod: req.method,
              headers: req.headers,
              queryStringParameters: req.query,
              pathParameters: req.params,
              body: req.body ? JSON.stringify(req.body) : null,
            };
            const lambdaResponse: APIGatewayProxyResult = await handler(event);
            if (lambdaResponse.hasOwnProperty("headers")) {
              for (const [k, v] of Object.entries(lambdaResponse.headers)) {
                res.setHeader(k, v.toString());
              }
            }
            res
              .status(lambdaResponse.statusCode)
              .send(JSON.parse(lambdaResponse.body));
          };
        } else {
          const handler = module.default;
          if (handler.toString().includes("context")) {
            expressHandler = async (req: Request, res: Response) => {
              const context: any = {
                log: (msg: string) =>
                  console.log(
                    `${chalk.gray(
                      `[${new Date().toISOString()}]`
                    )} ${chalk.cyan(msg)}`
                  ),
                executionContext: {
                  functionName: path
                    ? path.split("/")[path.split("/").length - 1]
                    : "",
                },
                res: {
                  status: 200,
                  body: "",
                },
              };
              const event = {
                url: `http://localhost:${PORT}${req.path}`,
                method: req.method,
                headers: req.headers,
                query: req.query,
                params: req.params,
                body: req.body,
              };

              await handler(context, event);
              const { status, body, headers } = context.res;
              if (headers) {
                for (const [k, v] of Object.entries(headers)) {
                  res.setHeader(k, v.toString());
                }
              }
              res.status(status || 200).send(body);
            };
          } else {
            expressHandler = handler;
          }
        }
        app.use(path, expressHandler);
      }
    }
  }

  app.use("/*", (req: Request, res: Response) => {
    res.sendFile(path.join(spaPath, "index.html"));
  });

  if ("errorHandler" in hooksModule) {
    app.use(hooksModule.errorHandler);
  }
};

const initEvents = async (io) => {
  const handlers = [];
  const files = getFiles(eventsFolderPath);
  for (const file of files.filter((f) => f.endsWith(".js"))) {
    const module = await import(file);
    const eventname = file
      .split("/")
      [file.split("/").length - 1].replace(".js", "");
    handlers.push({
      eventname,
      handler: module.default,
    });
    console.log(chalk.green(`Registered ${eventname} event.\n`));
  }

  io.on("connection", (socket) => {
    handlers.forEach((h) => {
      socket.on(h.eventname, h.handler(io, socket));
    });
  });

  io.engine.on("connection_error", (err) => {
    console.log(err.req); // the request object
    console.log(err.code); // the error code, for example 1
    console.log(err.message); // the error message, for example "Session ID unknown"
    console.log(err.context); // some additional error context
  });
};

const startExpressServer = async () => {
  let hooksModule: any = {};
  if (fs.existsSync(hooksFilePath)) {
    hooksModule = await import(hooksFilePath);
  }

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: process.env.request_body_size || "100kb" }));
  app.use(express.static("public"));

  app.use(express.static(spaPath));

  if ("beforeServerStart" in hooksModule) {
    if (isAsyncFunction(hooksModule.beforeServerStart)) {
      await hooksModule.beforeServerStart(app);
    } else {
      hooksModule.beforeServerStart(app);
    }
  }
  const server = app.listen(PORT, async () => {
    console.log(chalk.gray(`Server listening on port ${PORT}\n`));
    if ("afterServerStart" in hooksModule) {
      if (isAsyncFunction(hooksModule.afterServerStart)) {
        await hooksModule.afterServerStart(server);
      } else {
        hooksModule.afterServerStart(server);
      }
    }
    await initRoutes(app, hooksModule);
    if (fs.existsSync(eventsFolderPath)) {
      const io = new Server(server, {
        cors: {
          origin: "*",
        },
      });

      initEvents(io);
    }
  });
};

const args = process.argv.slice(2);

if (!args.length || args.includes("start")) {
  startExpressServer();
} else if (args.includes("build")) {
  if (args.includes("--azure-functions")) {
    buildAzureFunction();
  }
  if (args.includes("--aws-lambda")) {
    buildAwsLambda();
  }
}
