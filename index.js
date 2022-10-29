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
const node_path_1 = __importDefault(require("node:path"));
const chalk_1 = __importDefault(require("chalk"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_cluster_1 = __importDefault(require("node:cluster"));
const node_os_1 = __importDefault(require("node:os"));
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const types_1 = require("util/types");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const get_files_1 = __importDefault(require("./utils/get-files"));
const build_azure_function_1 = __importDefault(require("./build-azure-function"));
const build_aws_lambda_1 = __importDefault(require("./build-aws-lambda"));
const parse_route_1 = __importDefault(require("./utils/parse-route"));
const shared_memory_1 = __importStar(require("./shared-memory"));
let io;
const PORT = process.env.port || 3000;
let worker_processes = 1;
if (process.env.worker_processes == "auto") {
    worker_processes = node_os_1.default.cpus().length;
}
else {
    worker_processes = parseInt(process.env.worker_processes || "1");
}
const configFilePath = node_path_1.default.join(process.cwd(), "config.js");
const hooksFilePath = node_path_1.default.join(process.cwd(), "hooks.js");
const routesFolderPath = node_path_1.default.join(process.cwd(), "routes");
const graphqlFolderPath = node_path_1.default.join(process.cwd(), "graphql");
const eventsFolderPath = node_path_1.default.join(process.cwd(), "events");
const swaggerFilePath = node_path_1.default.join(process.cwd(), "swagger.json");
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
const spaPath = node_path_1.default.join(process.cwd(), process.env.spa_path || "dist");
const initRoutes = (app, hooksModule = {}) => __awaiter(void 0, void 0, void 0, function* () {
    if (node_fs_1.default.existsSync(graphqlFolderPath) &&
        node_fs_1.default.existsSync(node_path_1.default.join(graphqlFolderPath, "schema.gql"))) {
        const schemaContents = node_fs_1.default.readFileSync(node_path_1.default.join(graphqlFolderPath, "schema.gql"), "utf8");
        const module = yield Promise.resolve().then(() => __importStar(require(node_path_1.default.join(graphqlFolderPath, "root.js"))));
        app.use(process.env.graphql_path || "/graphql", (0, express_graphql_1.graphqlHTTP)({
            schema: (0, graphql_1.buildSchema)(schemaContents),
            rootValue: module.default,
            graphiql: true,
        }));
        console.log(chalk_1.default.gray(`Running a GraphQL API server at http://localhost:${PORT}${process.env.graphql_path || "/graphql"}\n`));
    }
    const routes = (0, get_files_1.default)(routesFolderPath);
    if (routes.length) {
        console.log(chalk_1.default.yellow("Routes:\n"));
        for (const route of routes) {
            if (route.endsWith(".js")) {
                const { route_path, func_name } = (0, parse_route_1.default)(route.replace(routesFolderPath, ""));
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
                console.log(`\t${chalk_1.default.yellow(name)} ${chalk_1.default.green("[GET,POST,PUT,PATCH,DELETE] http://localhost:" + PORT + route_path)}\n`);
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
                app.use(route_path, expressHandler);
            }
        }
    }
    if (!node_fs_1.default.existsSync(swaggerFilePath)) {
        node_fs_1.default.writeFileSync(swaggerFilePath, JSON.stringify(openapi, null, 2));
    }
    const swaggerDocument = yield Promise.resolve().then(() => __importStar(require(swaggerFilePath)));
    app.use("/swagger", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
    console.log(`\t${chalk_1.default.yellow("swagger")} ${chalk_1.default.green("[GET] http://localhost:" + PORT + "/swagger")}\n`);
    if (node_fs_1.default.existsSync(spaPath)) {
        app.use("/*", (req, res) => {
            res.sendFile(node_path_1.default.join(spaPath, "index.html"));
        });
    }
    if ("errorHandler" in hooksModule) {
        app.use(hooksModule.errorHandler);
    }
});
const initEvents = (io) => __awaiter(void 0, void 0, void 0, function* () {
    const handlers = [];
    const files = (0, get_files_1.default)(eventsFolderPath);
    for (const file of files.filter((f) => f.endsWith(".js"))) {
        const module = yield Promise.resolve().then(() => __importStar(require(file)));
        const filearr = file.split(process.platform == "win32" ? "\\" : "/");
        const eventname = filearr[filearr.length - 1].replace(".js", "");
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
});
const startExpressServer = () => __awaiter(void 0, void 0, void 0, function* () {
    let configs = {};
    let hooksModule = {};
    if (node_fs_1.default.existsSync(hooksFilePath)) {
        hooksModule = yield Promise.resolve().then(() => __importStar(require(hooksFilePath)));
    }
    if (node_fs_1.default.existsSync(configFilePath)) {
        const configModule = yield Promise.resolve().then(() => __importStar(require(configFilePath)));
        configs = configModule.default;
    }
    const app = (0, express_1.default)();
    if ("beforeServerStart" in hooksModule) {
        if ((0, types_1.isAsyncFunction)(hooksModule.beforeServerStart)) {
            yield hooksModule.beforeServerStart(app);
        }
        else {
            hooksModule.beforeServerStart(app);
        }
    }
    if ("cors" in configs) {
        app.use((0, cors_1.default)(configs.cors));
    }
    else {
        app.use((0, cors_1.default)());
    }
    if ("bodyParser" in configs) {
        app.use(express_1.default.json(configs.bodyParser));
    }
    else {
        app.use(express_1.default.json({ limit: process.env.request_body_size || "100kb" }));
    }
    app.use(express_1.default.static("public"));
    app.use(express_1.default.static(spaPath));
    if (node_cluster_1.default.isPrimary) {
        const msgHandler = (msg) => {
            for (const [k, v] of Object.entries(msg)) {
                if (v == null) {
                    delete shared_memory_1.state[k];
                }
                else {
                    shared_memory_1.state[k] = v;
                }
            }
            for (const id in node_cluster_1.default.workers) {
                node_cluster_1.default.workers[id].send(msg);
            }
        };
        for (let i = 0; i < worker_processes; i++) {
            const worker = node_cluster_1.default.fork();
            worker.on("message", msgHandler);
        }
        node_cluster_1.default.on("exit", (worker) => {
            console.log(`Worker ${worker.process.pid} died!`);
            const newWorker = node_cluster_1.default.fork();
            newWorker.on("message", msgHandler);
        });
    }
    else {
        process.on("message", (msg) => {
            for (const [k, v] of Object.entries(msg.payload)) {
                if (v == null) {
                    delete shared_memory_1.state[k];
                }
                else {
                    shared_memory_1.state[k] = v;
                }
            }
        });
        const server = process.env.ssl_key && process.env.ssl_cert
            ? node_https_1.default.createServer({
                key: node_fs_1.default.readFileSync(process.env.ssl_key),
                cert: node_fs_1.default.readFileSync(process.env.ssl_cert),
            }, app)
            : node_http_1.default.createServer(app);
        server.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
            console.log(chalk_1.default.gray(`Server ${process.pid} listening on port ${PORT}\n`));
            if ("afterServerStart" in hooksModule) {
                if ((0, types_1.isAsyncFunction)(hooksModule.afterServerStart)) {
                    yield hooksModule.afterServerStart(server);
                }
                else {
                    hooksModule.afterServerStart(server);
                }
            }
            if (process.env.peer_connection == "on") {
                const { ExpressPeerServer } = yield Promise.resolve().then(() => __importStar(require("peer")));
                let peerOptions = {};
                if ("peer" in configs) {
                    peerOptions = Object.assign(Object.assign({}, peerOptions), configs.peer);
                }
                const peerServer = ExpressPeerServer(server, peerOptions);
                if ("afterPeerConnected" in hooksModule) {
                    if ((0, types_1.isAsyncFunction)(hooksModule.afterPeerConnected)) {
                        yield peerServer.on("connection", hooksModule.afterPeerConnected);
                    }
                    else {
                        peerServer.on("connection", hooksModule.afterPeerConnected);
                    }
                }
                if ("afterPeerDisconnected" in hooksModule) {
                    if ((0, types_1.isAsyncFunction)(hooksModule.afterPeerDisconnected)) {
                        yield peerServer.on("disconnect", hooksModule.afterPeerDisconnected);
                    }
                    else {
                        peerServer.on("disconnect", hooksModule.afterPeerDisconnected);
                    }
                }
                app.use("/peerjs", peerServer);
            }
            yield initRoutes(app, hooksModule);
            if (node_fs_1.default.existsSync(eventsFolderPath) &&
                process.env.peer_connection != "on") {
                io = new socket_io_1.Server(server, {
                    cors: {
                        origin: "*",
                    },
                });
                if ("afterSocketIOStart" in hooksModule) {
                    if ((0, types_1.isAsyncFunction)(hooksModule.afterSocketIOStart)) {
                        yield hooksModule.afterSocketIOStart(io);
                    }
                    else {
                        hooksModule.afterSocketIOStart(io);
                    }
                }
                initEvents(io);
            }
        }));
    }
});
const args = process.argv.slice(2);
if (args.includes("start")) {
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
const server = {
    start: startExpressServer,
    getIO: () => {
        if (!io) {
            throw new Error("Socket.IO is not initialized!");
        }
        return io;
    },
    sharedMemory: shared_memory_1.default,
};
exports.default = server;
