export default function parseRoute(route: string, mode = "express") {
  let route_path = route
    .replace(process.platform == "win32" ? "\\index.js" : "/index.js", "")
    .replace(".js", "");
  if (mode == "function") {
    route_path = route_path
      .split(process.platform == "win32" ? "\\" : "/")
      .map((r) => {
        if (r.startsWith(":")) {
          return `{${r.replace(":", "")}}`;
        }
        return r;
      })
      .join("/");
  }
  const name = route_path
    .split(process.platform == "win32" ? "\\" : "/")
    .filter((r) => r.trim())
    .join("_");
  return {
    route_path,
    func_name: name,
  };
}
