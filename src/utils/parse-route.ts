export default function parseRoute(route: string, mode = "express") {
  let route_path = route
    .split(process.platform == "win32" ? "\\" : "/")
    .join("/")
    .replace("/index.js", "")
    .replace(".js", "");
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
