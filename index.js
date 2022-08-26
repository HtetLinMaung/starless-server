#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const express_graphql_1 = require("express-graphql");
const graphql_1 = require("graphql");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const get_files_1 = __importDefault(require("./utils/get-files"));
const build_azure_function_1 = __importDefault(require("./build-azure-function"));
const build_aws_lambda_1 = __importDefault(require("./build-aws-lambda"));
const spaPath = path_1.default.join(process.cwd(), process.env.spa_path || "dist");
const initEvents = (io) => __awaiter(void 0, void 0, void 0, function* () {
    const eventsFolderPath = path_1.default.join(process.cwd(), "events");
    const handlers = [];
    if (fs_1.default.existsSync(eventsFolderPath)) {
        const files = (0, get_files_1.default)(eventsFolderPath);
        for (const file of files.filter((f) => f.endsWith(".js"))) {
            const module = yield Promise.resolve().then(() => __importStar(require(file)));
            const eventname = file
                .split("/")[file.split("/").length - 1].replace(".js", "");
            handlers.push({
                eventname,
                handler: module.default,
            });
            console.log(chalk_1.default.green(`Registered ${eventname} event.\n`));
        }
        io.on("connection", (socket) => {
            handlers.forEach((h) => {
                socket.on(h.eventname, h.handler(io, socket));
            });
        });
        io.engine.on("connection_error", (err) => {
            console.log(err.req);
            console.log(err.code);
            console.log(err.message);
            console.log(err.context);
        });
    }
});
const startExpressServer = () => {
    const PORT = process.env.port || 3000;
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: process.env.request_body_size || "100kb" }));
    app.use(express_1.default.static("public"));
    app.use(express_1.default.static(spaPath));
    const routesFolderPath = path_1.default.join(process.cwd(), "routes");
    const graphqlFolderPath = path_1.default.join(process.cwd(), "graphql");
    const initRoutes = () => __awaiter(void 0, void 0, void 0, function* () {
        if (fs_1.default.existsSync(graphqlFolderPath) &&
            fs_1.default.existsSync(path_1.default.join(graphqlFolderPath, "schema.gql"))) {
            const schemaContents = fs_1.default.readFileSync(path_1.default.join(graphqlFolderPath, "schema.gql"), "utf8");
            const module = yield Promise.resolve().then(() => __importStar(require(path_1.default.join(graphqlFolderPath, "root.js"))));
            app.use(process.env.graphql_path || "/graphql", (0, express_graphql_1.graphqlHTTP)({
                schema: (0, graphql_1.buildSchema)(schemaContents),
                rootValue: module.default,
                graphiql: true,
            }));
            console.log(chalk_1.default.gray(`Running a GraphQL API server at http://localhost:${PORT}/${process.env.graphql_path || "/graphql"}\n`));
        }
        const routes = (0, get_files_1.default)(routesFolderPath);
        if (routes.length) {
            console.log(chalk_1.default.yellow("Routes:\n"));
            for (const route of routes) {
                if (route.endsWith(".js")) {
                    const path = route.replace(routesFolderPath, "").split(".")[0];
                    console.log(`\t${chalk_1.default.yellow(path.split("/")[path.split("/").length - 1])} ${chalk_1.default.green("[GET,POST,PUT,PATCH,DELETE] http://localhost:" + PORT + path)}\n`);
                    const module = yield Promise.resolve().then(() => __importStar(require(route)));
                    let expressHandler = null;
                    if ("handler" in module) {
                        const { handler } = module;
                        expressHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
                            const event = {
                                path: req.path,
                                httpMethod: req.method,
                                headers: req.headers,
                                queryStringParameters: req.query,
                                pathParameters: req.params,
                                body: req.body ? JSON.stringify(req.body) : null,
                            };
                            const lambdaResponse = yield handler(event);
                            if (lambdaResponse.hasOwnProperty("headers")) {
                                for (const [k, v] of Object.entries(lambdaResponse.headers)) {
                                    res.setHeader(k, v.toString());
                                }
                            }
                            res
                                .status(lambdaResponse.statusCode)
                                .send(JSON.parse(lambdaResponse.body));
                        });
                    }
                    else {
                        const handler = module.default;
                        if (handler.toString().includes("context")) {
                            expressHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
                                const context = {
                                    log: (msg) => console.log(`${chalk_1.default.gray(`[${new Date().toISOString()}]`)} ${chalk_1.default.cyan(msg)}`),
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
                                yield handler(context, event);
                                const { status, body, headers } = context.res;
                                if (headers) {
                                    for (const [k, v] of Object.entries(headers)) {
                                        res.setHeader(k, v.toString());
                                    }
                                }
                                res.status(status || 200).send(body);
                            });
                        }
                        else {
                            expressHandler = handler;
                        }
                    }
                    app.use(path, expressHandler);
                }
            }
        }
        app.use("/*", (req, res) => {
            res.sendFile(path_1.default.join(spaPath, "index.html"));
        });
    });
    const server = app.listen(PORT, () => {
        console.log(chalk_1.default.gray(`Server listening on port ${PORT}\n`));
        initRoutes().then(() => {
            const io = new socket_io_1.Server(server, {
                cors: {
                    origin: "*",
                },
            });
            initEvents(io);
        });
    });
};
const args = process.argv.slice(2);
if (!args.length || args.includes("start")) {
    startExpressServer();
}
else if (args.includes("build")) {
    if (args.includes("--azure-functions")) {
        (0, build_azure_function_1.default)();
    }
    if (args.includes("--aws-lambda")) {
        (0, build_aws_lambda_1.default)();
    }
}
