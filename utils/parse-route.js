"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function parseRoute(route, mode = "express") {
    let route_path = route
        .split(process.platform == "win32" ? "\\" : "/")
        .join("/")
        .replace("/index.js", "")
        .replace(".js", "");
    for (const match of route_path.match(/\[(\w+)\]/g)) {
        route_path = route_path.replace(match, `:${match.replace("[", "").replace("]", "")}`);
    }
    if (mode == "function") {
        route_path = route_path
            .split("/")
            .map((r) => {
            if (r.startsWith(":")) {
                return `{${r.replace(":", "")}}`;
            }
            return r;
        })
            .join("/");
    }
    const name = route_path
        .split("/")
        .filter((r) => r.trim())
        .join("_")
        .replace(/{/g, "")
        .replace(/}/g, "");
    return {
        route_path,
        func_name: name,
    };
}
exports.default = parseRoute;
