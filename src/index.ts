#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, Express, NextFunction } from "express";
import { graphqlHTTP } from "express-graphql";
import { buildSchema } from "graphql";
import { Server } from "socket.io";
import { APIGatewayProxyResult } from "aws-lambda";
import cors from "cors";
import path from "node:path";
import chalk from "chalk";
import fs from "node:fs";
import cluster from "node:cluster";
import os from "node:os";
import http from "node:http";
import https from "node:https";
import { isAsyncFunction } from "util/types";
import { createAdapter, setupPrimary } from "@socket.io/cluster-adapter";
import { setupMaster, setupWorker } from "@socket.io/sticky";

import swaggerUi from "swagger-ui-express";
import getFiles from "./utils/get-files";
import buildAzureFunction from "./build-azure-function";
import buildAwsLambda from "./build-aws-lambda";
import parseRoute from "./utils/parse-route";
import sharedMemory, { state } from "./shared-memory";
import buildAwsSamLambda from "./build-aws-sam-lambda";

let io: any;

const PORT = process.env.port || 3000;
let worker_processes = 1;
if (process.env.worker_processes == "auto") {
  worker_processes = os.cpus().length;
} else {
  worker_processes = parseInt(process.env.worker_processes || "1");
}

const configFilePath = path.join(process.cwd(), "config.js");
const hooksFilePath = path.join(process.cwd(), "hooks.js");
const routesFolderPath = path.join(process.cwd(), "routes");
const graphqlFolderPath = path.join(process.cwd(), "graphql");
const eventsFolderPath = path.join(process.cwd(), "events");
const swaggerFilePath = path.join(process.cwd(), "swagger.json");
const openapi = {
  openapi: "3.0.3",
  info: {
    title: "OpenAPI 3.0",
    description: "",
    version: "1.0.11",
  },
  servers: [
    {
      url: "http://localhost:" + PORT,
    },
  ],
  tags: [
    {
      name: "routes",
      description: "Everything about your Routes",
    },
  ],
  paths: {},
};

const spaPath = path.join(process.cwd(), process.env.spa_path || "dist");

const initRoutes = async (
  app: Express,
  hooksModule: any = {},
  configs: any = {}
) => {
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
        const { route_path, func_name } = parseRoute(
          route.replace(routesFolderPath, "")
        );

        const name = func_name;
        openapi.paths[route_path] = {
          get: {
            tags: ["routes"],
            operationId: `get${name}`,
          },
          post: {
            tags: ["routes"],
            operationId: `post${name}`,
          },
          put: {
            tags: ["routes"],
            operationId: `put${name}`,
          },
          patch: {
            tags: ["routes"],
            operationId: `patch${name}`,
          },
          delete: {
            tags: ["routes"],
            operationId: `delete${name}`,
          },
        };

        console.log(
          `\t${chalk.yellow(name)} ${chalk.green(
            "[GET,POST,PUT,PATCH,DELETE] http://localhost:" + PORT + route_path
          )}\n`
        );

        const module = await import(route);

        let expressHandler = null;
        if ("handler" in module) {
          const { handler } = module;
          expressHandler = async (req: Request, res: Response) => {
            let doCache = false;
            if ("rules" in configs) {
              for (const rule of configs.rules) {
                if (
                  req.baseUrl.match(new RegExp(rule.url)) &&
                  rule.method.toLowerCase() == req.method.toLowerCase() &&
                  rule.cache
                ) {
                  doCache = true;
                  break;
                }
              }
            }
            let reqHeaders = { ...req.headers };
            delete reqHeaders["postman-token"];
            const cacheKeyData = {
              params: req.params,
              query: req.query,
              body: req.body,
              headers: reqHeaders,
              method: req.method,
              url: req.baseUrl,
            };
            const cacheKey = JSON.stringify(cacheKeyData);
            const cacheData = sharedMemory.get(cacheKey);
            if (doCache && cacheData) {
              for (const [k, v] of Object.entries(cacheData.headers)) {
                res.setHeader(k, v.toString());
              }
              if (typeof cacheData.body == "object") {
                res.status(cacheData.status).json(cacheData.body);
              } else {
                res.status(cacheData.status).send(cacheData.body);
              }
            } else {
              const event = {
                path: req.path,
                httpMethod: req.method,
                headers: req.headers,
                queryStringParameters: req.query,
                pathParameters: req.params,
                body: req.body ? JSON.stringify(req.body) : null,
              };
              const lambdaResponse: APIGatewayProxyResult = await handler(
                event
              );
              if (lambdaResponse.hasOwnProperty("headers")) {
                for (const [k, v] of Object.entries(lambdaResponse.headers)) {
                  res.setHeader(k, v.toString());
                }
              }
              res
                .status(lambdaResponse.statusCode)
                .send(JSON.parse(lambdaResponse.body));

              if (doCache) {
                const newCacheData = {
                  status: lambdaResponse.statusCode,
                  headers: lambdaResponse.headers || {},
                  body: JSON.parse(lambdaResponse.body),
                };
                sharedMemory.set(cacheKey, newCacheData);
                if (
                  io &&
                  cacheData &&
                  JSON.stringify(cacheData) != JSON.stringify(newCacheData)
                ) {
                  io.emit("cache:update", req.query.cachesession);
                }
              }
            }
          };
        } else {
          const handler = module.default;
          if (handler.toString().includes("context")) {
            expressHandler = async (req: Request, res: Response) => {
              let doCache = false;
              if ("rules" in configs) {
                for (const rule of configs.rules) {
                  if (
                    req.baseUrl.match(new RegExp(rule.url)) &&
                    rule.method.toLowerCase() == req.method.toLowerCase() &&
                    rule.cache
                  ) {
                    doCache = true;
                    break;
                  }
                }
              }
              let reqHeaders = { ...req.headers };
              delete reqHeaders["postman-token"];
              const cacheKeyData = {
                params: req.params,
                query: req.query,
                body: req.body,
                headers: reqHeaders,
                method: req.method,
                url: req.baseUrl,
              };
              const cacheKey = JSON.stringify(cacheKeyData);
              const cacheData = sharedMemory.get(cacheKey);
              if (doCache && cacheData) {
                for (const [k, v] of Object.entries(cacheData.headers)) {
                  res.setHeader(k, v.toString());
                }

                if (typeof cacheData.body == "object") {
                  res.status(cacheData.status).json(cacheData.body);
                } else {
                  res.status(cacheData.status).send(cacheData.body);
                }
              } else {
                const context: any = {
                  log: (msg: string) =>
                    console.log(
                      `${chalk.gray(
                        `[${new Date().toISOString()}]`
                      )} ${chalk.cyan(msg)}`
                    ),
                  executionContext: {
                    functionName: route_path ? name : "",
                  },
                  bindingData: req.params,
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
                  body:
                    req.body && Object.keys(req.body).length
                      ? req.body
                      : undefined,
                };

                await handler(context, event);
                const { status, body, headers } = context.res;
                if (headers) {
                  for (const [k, v] of Object.entries(headers)) {
                    res.setHeader(k, v.toString());
                  }
                }
                res.status(status || 200).send(body);

                if (doCache) {
                  const newCacheData = {
                    status: status || 200,
                    headers: headers || {},
                    body,
                  };
                  sharedMemory.set(cacheKey, newCacheData);
                  if (
                    io &&
                    cacheData &&
                    JSON.stringify(cacheData) != JSON.stringify(newCacheData)
                  ) {
                    io.emit("cache:update", req.query.cachesession);
                  }
                }
              }
            };
          } else {
            if (process.env.express_handler_mode != "native") {
              expressHandler = async (
                req: Request,
                res: Response,
                next: NextFunction
              ) => {
                let doCache = false;
                if ("rules" in configs) {
                  for (const rule of configs.rules) {
                    if (
                      req.baseUrl.match(new RegExp(rule.url)) &&
                      rule.method.toLowerCase() == req.method.toLowerCase() &&
                      rule.cache
                    ) {
                      doCache = true;
                      break;
                    }
                  }
                }
                let reqHeaders = { ...req.headers };
                delete reqHeaders["postman-token"];
                const cacheKeyData = {
                  params: req.params,
                  query: req.query,
                  body: req.body,
                  headers: reqHeaders,
                  method: req.method,
                  url: req.baseUrl,
                };
                const cacheKey = JSON.stringify(cacheKeyData);
                const cacheData = sharedMemory.get(cacheKey);
                if (doCache && cacheData) {
                  for (const [k, v] of Object.entries(cacheData.headers)) {
                    res.setHeader(k, v.toString());
                  }

                  if (typeof cacheData.body == "object") {
                    res.status(cacheData.status).json(cacheData.body);
                  } else {
                    res.status(cacheData.status).send(cacheData.body);
                  }
                } else {
                  let newCacheData = { body: {}, headers: {}, status: 200 };
                  let newRes: any = { ...res, expressResponse: res };
                  newRes.json = (body: any = {}) => {
                    newCacheData.body = body;
                    return res.json(body);
                  };
                  newRes.send = (body: any = "") => {
                    newCacheData.body = body;
                    return res.send(body);
                  };
                  newRes.status = (code: number) => {
                    newRes.status(code).json = (body: any = {}) => {
                      newCacheData.body = body;
                      return res.json(body);
                    };
                    newRes.status(code).send = (body: any = "") => {
                      newCacheData.body = body;
                      return res.send(body);
                    };
                    newCacheData.status = code;
                    return res.status(code);
                  };

                  newRes.setHeader = (
                    name: string,
                    value: string | number | readonly string[]
                  ) => {
                    newCacheData.headers[name] = value;
                    return res.setHeader(name, value);
                  };
                  if (isAsyncFunction(handler)) {
                    await handler(req, newRes, next);
                  } else {
                    handler(req, newRes, next);
                  }

                  if (doCache) {
                    sharedMemory.set(cacheKey, newCacheData);
                    if (
                      io &&
                      cacheData &&
                      JSON.stringify(cacheData) != JSON.stringify(newCacheData)
                    ) {
                      io.emit("cache:update", req.query.cachesession);
                    }
                  }
                }
              };
            } else {
              expressHandler = handler;
            }
          }
        }
        app.use(route_path, expressHandler);
      }
    }
  }

  if (!fs.existsSync(swaggerFilePath)) {
    fs.writeFileSync(swaggerFilePath, JSON.stringify(openapi, null, 2));
  }
  const swaggerDocument = await import(swaggerFilePath);
  app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log(
    `\t${chalk.yellow("swagger")} ${chalk.green(
      "[GET] http://localhost:" + PORT + "/swagger"
    )}\n`
  );

  if (fs.existsSync(spaPath)) {
    app.get("/*", (req: Request, res: Response) => {
      res.sendFile(path.join(spaPath, "index.html"));
    });
  }

  if ("errorHandler" in hooksModule) {
    app.use(hooksModule.errorHandler);
  }
};

const initEvents = async (io) => {
  const handlers = [];
  const files = getFiles(eventsFolderPath);
  for (const file of files.filter((f) => f.endsWith(".js"))) {
    const module = await import(file);
    const filearr = file.split(process.platform == "win32" ? "\\" : "/");
    const eventname = filearr[filearr.length - 1].replace(".js", "");
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
  let configs: any = {};
  let hooksModule: any = {};
  if (fs.existsSync(hooksFilePath)) {
    hooksModule = await import(hooksFilePath);
  }
  if (fs.existsSync(configFilePath)) {
    const configModule = await import(configFilePath);
    configs = configModule.default;
  }
  const app = express();

  if ("beforeServerStart" in hooksModule) {
    if (isAsyncFunction(hooksModule.beforeServerStart)) {
      await hooksModule.beforeServerStart(app);
    } else {
      hooksModule.beforeServerStart(app);
    }
  }

  if ("cors" in configs) {
    app.use(cors(configs.cors));
  } else {
    app.use(cors());
  }

  if ("bodyParser" in configs) {
    app.use(express.json(configs.bodyParser));
  } else {
    app.use(express.json({ limit: process.env.request_body_size || "100kb" }));
  }

  app.use(express.static("public"));

  app.use(express.static(spaPath));

  const server =
    process.env.ssl_key && process.env.ssl_cert
      ? https.createServer(
          {
            key: fs.readFileSync(process.env.ssl_key),
            cert: fs.readFileSync(process.env.ssl_cert),
          },
          app
        )
      : http.createServer(app);

  if (cluster.isPrimary) {
    if ("afterMasterProcessStart" in hooksModule) {
      if (isAsyncFunction(hooksModule.afterMasterProcessStart)) {
        await hooksModule.afterMasterProcessStart(cluster);
      } else {
        hooksModule.afterMasterProcessStart(cluster);
      }
    }
    // setup sticky sessions
    setupMaster(server, {
      loadBalancingMethod: "least-connection",
    });

    // setup connections between the workers
    setupPrimary();

    // needed for packets containing buffers (you can ignore it if you only send plaintext objects)
    // Node.js < 16.0.0
    // cluster.setupMaster({
    //   serialization: "advanced",
    // } as any);
    // Node.js > 16.0.0
    cluster.setupPrimary({
      serialization: "advanced",
    } as any);

    const msgHandler = (msg) => {
      for (const [k, v] of Object.entries(msg)) {
        if (v == null) {
          delete state[k];
        } else {
          state[k] = v;
        }
      }
      for (const id in cluster.workers) {
        cluster.workers[id].send(msg);
      }
    };

    for (let i = 0; i < worker_processes; i++) {
      const worker = cluster.fork();
      worker.on("message", msgHandler);
    }
    cluster.on("exit", (worker) => {
      console.log(`Worker ${worker.process.pid} died!`);
      const newWorker = cluster.fork();
      newWorker.on("message", msgHandler);
    });
  } else {
    if ("afterWorkerStart" in hooksModule) {
      if (isAsyncFunction(hooksModule.afterWorkerStart)) {
        await hooksModule.afterWorkerStart(cluster);
      } else {
        hooksModule.afterWorkerStart(cluster);
      }
    }
    process.on("message", (msg: any) => {
      for (const [k, v] of Object.entries(msg)) {
        if (v == null) {
          delete state[k];
        } else {
          state[k] = v;
        }
      }
    });

    server.listen(PORT, async () => {
      console.log(
        chalk.gray(`Server ${process.pid} listening on port ${PORT}\n`)
      );
      if ("afterServerStart" in hooksModule) {
        if (isAsyncFunction(hooksModule.afterServerStart)) {
          await hooksModule.afterServerStart(server);
        } else {
          hooksModule.afterServerStart(server);
        }
      }
      if (process.env.peer_connection == "on") {
        const { ExpressPeerServer } = await import("peer");
        let peerOptions = {};
        if ("peer" in configs) {
          peerOptions = { ...peerOptions, ...configs.peer };
        }
        const peerServer = ExpressPeerServer(server, peerOptions);
        if ("afterPeerConnected" in hooksModule) {
          if (isAsyncFunction(hooksModule.afterPeerConnected)) {
            await peerServer.on("connection", hooksModule.afterPeerConnected);
          } else {
            peerServer.on("connection", hooksModule.afterPeerConnected);
          }
        }
        if ("afterPeerDisconnected" in hooksModule) {
          if (isAsyncFunction(hooksModule.afterPeerDisconnected)) {
            await peerServer.on(
              "disconnect",
              hooksModule.afterPeerDisconnected
            );
          } else {
            peerServer.on("disconnect", hooksModule.afterPeerDisconnected);
          }
        }

        app.use("/peerjs", peerServer);
      }
      await initRoutes(app, hooksModule, configs);
      if (
        fs.existsSync(eventsFolderPath) &&
        process.env.peer_connection != "on"
      ) {
        io = new Server(server, {
          cors: {
            origin: "*",
          },
        });

        // use the cluster adapter
        io.adapter(createAdapter());

        // setup connection with the primary process
        setupWorker(io);

        if ("afterSocketIOStart" in hooksModule) {
          if (isAsyncFunction(hooksModule.afterSocketIOStart)) {
            await hooksModule.afterSocketIOStart(io);
          } else {
            hooksModule.afterSocketIOStart(io);
          }
        }
        initEvents(io);
      }
    });
  }
};

const args = process.argv.slice(2);

if (args.includes("start")) {
  startExpressServer();
} else if (args.includes("build")) {
  if (args.includes("--azure-functions")) {
    buildAzureFunction();
  }
  if (args.includes("--aws-lambda")) {
    buildAwsLambda();
  }
  if (args.includes("--aws-sam-lambda")) {
    buildAwsSamLambda();
  }
}

const server = {
  start: startExpressServer,
  getIO: () => {
    if (!io) {
      throw new Error("Socket.IO is not initialized!");
    }
    return io;
  },
  sharedMemory,
};

export default server;
