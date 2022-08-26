import path from "path";
import fs from "fs";
import util from "util";
import getFiles from "./utils/get-files";

const exec = util.promisify(require("child_process").exec);

const rootPath = process.cwd();
const routesFolderPath = path.join(rootPath, "routes");

export default async function buildAzureFunction() {
  const azureProjectFolderName = "azure_functions";
  const azureProjectFolderPath = path.join(rootPath, azureProjectFolderName);
  if (fs.existsSync(azureProjectFolderPath)) {
    fs.rmSync(azureProjectFolderPath, { recursive: true });
  }
  const { stdout, stderr } = await exec(
    `func init ${azureProjectFolderName} --javascript --docker`
  );
  console.log(stdout);
  console.error(stderr);

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
        fs.cpSync(absolute, path.join(azureProjectFolderPath, file), {
          recursive: true,
        });
      } else {
        if (file.endsWith(".js")) {
          fs.cpSync(absolute, path.join(azureProjectFolderPath, file));
        }
      }
    }
  }

  let packagejson = JSON.parse(
    fs.readFileSync(path.join(rootPath, "package.json"), "utf8")
  );
  let dependencies = {};
  if (packagejson.hasOwnProperty("dependencies")) {
    dependencies = packagejson.dependencies;
  }
  packagejson = JSON.parse(
    fs.readFileSync(path.join(azureProjectFolderPath, "package.json"), "utf8")
  );
  if (packagejson.hasOwnProperty("dependencies")) {
    packagejson.dependencies = dependencies;
  }
  fs.writeFileSync(
    path.join(azureProjectFolderPath, "package.json"),
    JSON.stringify(packagejson, null, 2)
  );

  const routes = getFiles(routesFolderPath);
  for (const route of routes) {
    if (route.endsWith(".js")) {
      const routepath = route.replace(routesFolderPath, "").split(".")[0];
      const module = await import(route);
      const funcName = routepath.split("/")[routepath.split("/").length - 1];

      const funcFolderPath = path.join(azureProjectFolderPath, funcName);
      if (!fs.existsSync(funcFolderPath)) {
        fs.mkdirSync(funcFolderPath);
      }
      fs.cpSync(route, path.join(funcFolderPath, "index.js"));

      let fileContent = fs.readFileSync(
        path.join(funcFolderPath, "index.js"),
        "utf8"
      );
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
      fs.writeFileSync(
        path.join(funcFolderPath, "index.js"),
        fileContent
          .replace(/(\.\.\/)+/, "../")
          .replace("exports.handler = handler;", "")
          .replace("exports.handler = void 0;", "")
      );
      fs.writeFileSync(
        path.join(funcFolderPath, "function.json"),
        JSON.stringify(
          {
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
          },
          null,
          2
        )
      );
    }
  }
}
