import path from "path";
import fs from "fs";
import util from "util";
import zip from "adm-zip";
import getFiles from "./utils/get-files";
import parseRoute from "./utils/parse-route";

const exec = util.promisify(require("child_process").exec);

const rootPath = process.cwd();
const routesFolderPath = path.join(rootPath, "routes");

export default async function buildAwsSamLambda() {
  const awsProjectFolderName = "aws_sam_lambda";
  const awsProjectFolderPath = path.join(rootPath, awsProjectFolderName);
  const layersFolderPath = path.join(awsProjectFolderPath, "layers");
  const commonLayerFolderPath = path.join(layersFolderPath, "common");
  const commonLayerNodejsFolderPath = path.join(
    commonLayerFolderPath,
    "nodejs"
  );

  if (fs.existsSync(awsProjectFolderPath)) {
    fs.rmSync(awsProjectFolderPath, { recursive: true });
  }
  fs.mkdirSync(awsProjectFolderPath);
  if (!fs.existsSync(layersFolderPath)) {
    fs.mkdirSync(layersFolderPath);
    if (!fs.existsSync(commonLayerFolderPath)) {
      fs.mkdirSync(commonLayerFolderPath);
      if (!fs.existsSync(commonLayerNodejsFolderPath)) {
        fs.mkdirSync(commonLayerNodejsFolderPath);
      }
    }
  }

  const filesInDirectory = fs.readdirSync(rootPath);
  for (const file of filesInDirectory) {
    const absolute = path.join(rootPath, file);
    if (
      !absolute.includes("node_modules") &&
      !absolute.includes("azure_functions") &&
      !absolute.includes(awsProjectFolderName) &&
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
      !absolute.includes(".dockerignore")
    ) {
      if (fs.statSync(absolute).isDirectory()) {
        fs.cpSync(absolute, path.join(commonLayerFolderPath, file), {
          recursive: true,
        });
      } else {
        if (file.endsWith(".js")) {
          fs.cpSync(absolute, path.join(commonLayerFolderPath, file));
        }
      }
    }
  }
  const packagejson = JSON.parse(
    fs.readFileSync(path.join(rootPath, "package.json"), "utf8")
  );
  let dependencies = {};
  if (packagejson.hasOwnProperty("dependencies")) {
    dependencies = packagejson.dependencies;
  }
  fs.writeFileSync(
    path.join(commonLayerNodejsFolderPath, "package.json"),
    JSON.stringify(
      {
        dependencies,
      },
      null,
      2
    )
  );
  const { stdout, stderr } = await exec("npm i", {
    cwd: commonLayerNodejsFolderPath,
  });
  console.log(stdout);
  console.error(stderr);

  if (
    fs.existsSync(path.join(commonLayerNodejsFolderPath, "..", "common.zip"))
  ) {
    fs.rmSync(path.join(commonLayerNodejsFolderPath, "..", "common.zip"));
  }
  const zipFile = new zip();
  zipFile.addLocalFolder(path.join(commonLayerNodejsFolderPath, ".."));
  zipFile.writeZip(path.join(commonLayerNodejsFolderPath, "..", "common.zip"));

  const routes = getFiles(routesFolderPath);
  let templateYamlResources = "";
  for (const route of routes) {
    if (route.endsWith(".js")) {
      const { func_name, route_path } = parseRoute(
        route.replace(routesFolderPath, ""),
        "lambda"
      );

      const funcName = func_name;
      const module = await import(route);

      const funcFolderPath = path.join(awsProjectFolderPath, funcName);
      if (!fs.existsSync(funcFolderPath)) {
        fs.mkdirSync(funcFolderPath);
      }
      fs.cpSync(route, path.join(funcFolderPath, "index.js"));

      let fileContent = fs.readFileSync(
        path.join(funcFolderPath, "index.js"),
        "utf8"
      );
      if (
        "default" in module &&
        module.default.toString().includes("context")
      ) {
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
      } else if (
        "default" in module &&
        (module.default.toString().includes("res.json(") ||
          module.default.toString().includes("res.send(") ||
          module.default.toString().includes("res.status("))
      ) {
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
    await expressHandler(request, response);
  } else {
    expressHandler(request, response);
  }
  return lambdaRes;
};

exports.handler = handler;
`;
      }
      fs.writeFileSync(
        path.join(funcFolderPath, "index.js"),
        fileContent.replace(/(\.\.\/)+/g, "/opt/")
      );
      templateYamlResources += `
  ${funcName.replace(/_/g, "")}:
    Type: AWS::Serverless::Function 
    Properties:
      CodeUri: ${funcName}/
      Handler: index.handler
      Layers:
        - !Ref CommonLayer
      Runtime: nodejs16.x
      Architectures:
        - x86_64
      Events:
        ${funcName}:
          Type: Api 
          Properties:
            Path: /${route_path.slice(1, route_path.length)}
            Method: any\n`;
    }
  }
  const templateYaml = `
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: >
  samlab

  Sample SAM Template for samlab

# More info about Globals: https://github.com/awslabs/serverless-application-model/blob/master/docs/globals.rst
Globals:
  Function:
    Timeout: 60

Resources:
  ${templateYamlResources}
  CommonLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: sam-app-dependencies
      Description: Dependencies for sam app
      ContentUri: layers/common/
      CompatibleRuntimes:
        - nodejs16.x
      LicenseInfo: "MIT"
      RetentionPolicy: Retain`;
  fs.writeFileSync(
    path.join(awsProjectFolderPath, "template.yaml"),
    templateYaml
  );
}
