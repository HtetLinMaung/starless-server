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
const adm_zip_1 = __importDefault(require("adm-zip"));
const get_files_1 = __importDefault(require("./utils/get-files"));
const parse_route_1 = __importDefault(require("./utils/parse-route"));
const exec = util_1.default.promisify(require("child_process").exec);
const rootPath = process.cwd();
const routesFolderPath = path_1.default.join(rootPath, "routes");
function buildAwsLambda() {
    return __awaiter(this, void 0, void 0, function* () {
        const awsProjectFolderName = "aws_lambda";
        const awsProjectFolderPath = path_1.default.join(rootPath, awsProjectFolderName);
        const layersFolderPath = path_1.default.join(awsProjectFolderPath, "layers");
        const commonLayerFolderPath = path_1.default.join(layersFolderPath, "common");
        const commonLayerNodejsFolderPath = path_1.default.join(commonLayerFolderPath, "nodejs");
        if (fs_1.default.existsSync(awsProjectFolderPath)) {
            fs_1.default.rmSync(awsProjectFolderPath, { recursive: true });
        }
        fs_1.default.mkdirSync(awsProjectFolderPath);
        if (!fs_1.default.existsSync(layersFolderPath)) {
            fs_1.default.mkdirSync(layersFolderPath);
            if (!fs_1.default.existsSync(commonLayerFolderPath)) {
                fs_1.default.mkdirSync(commonLayerFolderPath);
                if (!fs_1.default.existsSync(commonLayerNodejsFolderPath)) {
                    fs_1.default.mkdirSync(commonLayerNodejsFolderPath);
                }
            }
        }
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
                !absolute.includes("config.js") &&
                !absolute.includes(".git") &&
                !absolute.includes(".gitignore") &&
                !absolute.includes("Dockerfile") &&
                !absolute.includes(".dockerignore")) {
                if (fs_1.default.statSync(absolute).isDirectory()) {
                    fs_1.default.cpSync(absolute, path_1.default.join(commonLayerFolderPath, file), {
                        recursive: true,
                    });
                }
                else {
                    if (file.endsWith(".js")) {
                        fs_1.default.cpSync(absolute, path_1.default.join(commonLayerFolderPath, file));
                    }
                }
            }
        }
        const packagejson = JSON.parse(fs_1.default.readFileSync(path_1.default.join(rootPath, "package.json"), "utf8"));
        let dependencies = {};
        if (packagejson.hasOwnProperty("dependencies")) {
            dependencies = packagejson.dependencies;
        }
        fs_1.default.writeFileSync(path_1.default.join(commonLayerNodejsFolderPath, "package.json"), JSON.stringify({
            dependencies,
        }, null, 2));
        const { stdout, stderr } = yield exec("npm i", {
            cwd: commonLayerNodejsFolderPath,
        });
        console.log(stdout);
        console.error(stderr);
        if (fs_1.default.existsSync(path_1.default.join(commonLayerNodejsFolderPath, "..", "common.zip"))) {
            fs_1.default.rmSync(path_1.default.join(commonLayerNodejsFolderPath, "..", "common.zip"));
        }
        const zipFile = new adm_zip_1.default();
        zipFile.addLocalFolder(path_1.default.join(commonLayerNodejsFolderPath, ".."));
        zipFile.writeZip(path_1.default.join(commonLayerNodejsFolderPath, "..", "common.zip"));
        const routes = (0, get_files_1.default)(routesFolderPath);
        for (const route of routes) {
            if (route.endsWith(".js")) {
                const { func_name } = (0, parse_route_1.default)(route.replace(routesFolderPath, ""), "lambda");
                const funcName = func_name;
                const module = yield Promise.resolve().then(() => __importStar(require(route)));
                const funcFolderPath = path_1.default.join(awsProjectFolderPath, funcName);
                if (!fs_1.default.existsSync(funcFolderPath)) {
                    fs_1.default.mkdirSync(funcFolderPath);
                }
                fs_1.default.cpSync(route, path_1.default.join(funcFolderPath, "index.js"));
                let fileContent = fs_1.default.readFileSync(path_1.default.join(funcFolderPath, "index.js"), "utf8");
                if ("default" in module &&
                    module.default.toString().includes("context")) {
                    fileContent =
                        fileContent
                            .replace("exports.default = httpTrigger;", "")
                            .replace("module.exports = httpTrigger;", "")
                            .replace("module.exports =", "const httpTrigger =") +
                            `
const handler = async (event) => {
  const context = {
    log: (msg) => console.log(\`[\${new Date().toISOString()}] \${msg}\`),
    executionContext: {
      functionName:
        event.path ? event.path.split("/")[event.path.split("/").length - 1]: "",
    },
    bindingData: event.pathParameters,
    res: {
      status: 200,
      body: "",
    },
  };
  const req = {
    url: event.path,
    method: event.httpMethod,
    headers: event.headers,
    query: event.queryStringParameters,
    params: event.pathParameters,
    body: event.body ? JSON.parse(event.body): null,
  };
  await httpTrigger(context, req);
  const { status, body, headers } = context.res;
  return {
    statusCode: status || 200,
    headers,
    body: typeof body == "object" ? JSON.stringify(body) : body,
  };
};

exports.handler = handler;
`;
                }
                else {
                    fileContent =
                        fileContent
                            .replace("exports.default =", "const expressHandler =")
                            .replace("module.exports =", "const expressHandler =") +
                            `
const handler = async (event) => {
  const request = {
    path: event.path,
    method: event.httpMethod,
    headers: event.headers,
    query: event.queryStringParameters,
    params: event.pathParameters,
    body: event.body ? JSON.parse(event.body): null,
  };
  let lambdaRes = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    },
  }
  const json = (obj) => {
    lambdaRes['body'] = JSON.stringify(obj || {});
  }
  const send = (data) => {
    lambdaRes['body'] = typeof data == 'object' ? JSON.stringify(data) : data;
  }
  const status = (code) => {
    lambdaRes.statusCode = code;
    return {json, send};
  }
  const response = {
    json,
    status,
    send,
  }
  if (expressHandler.toString().includes('async')) {
    await expressHandler(request, response, (sth) => {});
  } else {
    expressHandler(request, response, (sth) => {});
  }
  return lambdaRes;
};

exports.handler = handler;
`;
                }
                fs_1.default.writeFileSync(path_1.default.join(funcFolderPath, "index.js"), fileContent.replace(/(\.\.\/)+/g, "/opt/"));
            }
        }
    });
}
exports.default = buildAwsLambda;
