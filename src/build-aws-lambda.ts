import path from "path";
import fs from "fs";
import util from "util";
import zip from "adm-zip";
import getFiles from "./utils/get-files";

const exec = util.promisify(require("child_process").exec);

const rootPath = process.cwd();
const routesFolderPath = path.join(rootPath, "routes");

export default async function buildAwsLambda() {
  const awsProjectFolderName = "aws_lambda";
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
      !absolute.includes("aws_lambda") &&
      !absolute.includes("dist") &&
      !absolute.includes(".vscode") &&
      !absolute.includes("routes") &&
      !absolute.includes("graphql") &&
      !absolute.includes("events")
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
  for (const route of routes) {
    if (route.endsWith(".js")) {
      const routepath = route.replace(routesFolderPath, "").split(".")[0];
      const module = await import(route);
      const funcName = routepath.split("/")[routepath.split("/").length - 1];

      const funcFolderPath = path.join(awsProjectFolderPath, funcName);
      if (!fs.existsSync(funcFolderPath)) {
        fs.mkdirSync(funcFolderPath);
      }
      fs.cpSync(route, path.join(funcFolderPath, "index.js"));

      let fileContent = fs.readFileSync(
        path.join(funcFolderPath, "index.js"),
        "utf8"
      );
      if ("default" in module) {
        fileContent =
          fileContent.replace("exports.default = httpTrigger;", "") +
          `
const handler = async (event) => {
  const context = {
    log: (msg) => console.log(\`[\${new Date().toISOString()}] \${msg}\`),
    executionContext: {
      functionName:
        event.path ? event.path.split("/")[event.path.split("/").length - 1]: "",
    },
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
      fs.writeFileSync(
        path.join(funcFolderPath, "index.js"),
        fileContent.replace(/(\.\.\/)+/, "/opt/")
      );
    }
  }
}