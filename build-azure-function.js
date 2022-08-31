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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const util_1 = __importDefault(require("util"));
const get_files_1 = __importDefault(require("./utils/get-files"));
const parse_route_1 = __importDefault(require("./utils/parse-route"));
const exec = util_1.default.promisify(require("child_process").exec);
const rootPath = process.cwd();
const routesFolderPath = path_1.default.join(rootPath, "routes");
function buildAzureFunction() {
    return __awaiter(this, void 0, void 0, function* () {
        const azureProjectFolderName = "azure_functions";
        const azureProjectFolderPath = path_1.default.join(rootPath, azureProjectFolderName);
        if (fs_1.default.existsSync(azureProjectFolderPath)) {
            fs_1.default.rmSync(azureProjectFolderPath, { recursive: true });
        }
        const { stdout, stderr } = yield exec(`func init ${azureProjectFolderName} --javascript --docker`);
        console.log(stdout);
        console.error(stderr);
        const filesInDirectory = fs_1.default.readdirSync(rootPath);
        for (const file of filesInDirectory) {
            const absolute = path_1.default.join(rootPath, file);
            if (!absolute.includes("node_modules") &&
                !absolute.includes("azure_functions") &&
                !absolute.includes("aws_lambda") &&
                !absolute.includes("dist") &&
                !absolute.includes(".vscode") &&
                !absolute.includes("routes") &&
                !absolute.includes("graphql") &&
                !absolute.includes("events") &&
                !absolute.includes("hooks.js") &&
                !absolute.includes("config.js")) {
                if (fs_1.default.statSync(absolute).isDirectory()) {
                    fs_1.default.cpSync(absolute, path_1.default.join(azureProjectFolderPath, file), {
                        recursive: true,
                    });
                }
                else {
                    if (file.endsWith(".js")) {
                        fs_1.default.cpSync(absolute, path_1.default.join(azureProjectFolderPath, file));
                    }
                }
            }
        }
        let packagejson = JSON.parse(fs_1.default.readFileSync(path_1.default.join(rootPath, "package.json"), "utf8"));
        let dependencies = {};
        if (packagejson.hasOwnProperty("dependencies")) {
            dependencies = packagejson.dependencies;
        }
        packagejson = JSON.parse(fs_1.default.readFileSync(path_1.default.join(azureProjectFolderPath, "package.json"), "utf8"));
        if (packagejson.hasOwnProperty("dependencies")) {
            packagejson.dependencies = dependencies;
        }
        fs_1.default.writeFileSync(path_1.default.join(azureProjectFolderPath, "package.json"), JSON.stringify(packagejson, null, 2));
        const routes = (0, get_files_1.default)(routesFolderPath);
        for (const route of routes) {
            if (route.endsWith(".js")) {
                const { route_path, func_name } = (0, parse_route_1.default)(route.replace(routesFolderPath, ""), "function");
                const routepath = route_path;
                const funcName = route_path.split("/").join("_");
                const module = yield Promise.resolve().then(() => __importStar(require(route)));
                const funcFolderPath = path_1.default.join(azureProjectFolderPath, funcName);
                if (!fs_1.default.existsSync(funcFolderPath)) {
                    fs_1.default.mkdirSync(funcFolderPath);
                }
                fs_1.default.cpSync(route, path_1.default.join(funcFolderPath, "index.js"));
                let fileContent = fs_1.default.readFileSync(path_1.default.join(funcFolderPath, "index.js"), "utf8");
                if ("handler" in module) {
                    fileContent =
                        fileContent +
                            `
    const httpTrigger = async function (
      context,
      req
    ) {
      context.log("HTTP trigger function processed a request.");
      const event = {
        path: req.url,
        httpMethod: req.method,
        headers: req.headers,
        queryStringParameters: req.query,
        pathParameters: req.params,
        body: req.body ? JSON.stringify(req.body): null,
      };
      const lambdaResponse = await handler(event);
      context.res = {
        status: lambdaResponse.statusCode,
        body: JSON.parse(lambdaResponse.body),
        headers: lambdaResponse.headers,
      };
    };
    
    module.exports = httpTrigger;`;
                }
                fs_1.default.writeFileSync(path_1.default.join(funcFolderPath, "index.js"), fileContent
                    .replace(/(\.\.\/)+/, "../")
                    .replace("exports.handler = handler;", "")
                    .replace("exports.handler = void 0;", ""));
                fs_1.default.writeFileSync(path_1.default.join(funcFolderPath, "function.json"), JSON.stringify({
                    bindings: [
                        {
                            authLevel: "anonymous",
                            type: "httpTrigger",
                            direction: "in",
                            name: "req",
                            methods: ["get", "post", "put", "patch", "delete"],
                            route: routepath.slice(1, routepath.length),
                        },
                        {
                            type: "http",
                            direction: "out",
                            name: "res",
                        },
                    ],
                    scriptFile: `index.js`,
                }, null, 2));
            }
        }
    });
}
exports.default = buildAzureFunction;
