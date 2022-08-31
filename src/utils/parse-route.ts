export default function parseRoute(route: string, mode = "express") {
  let route_path = route.replace("/index.js", "").replace(".js", "");
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
  const name = route_path.split("/")[route_path.split("/").length - 1];
  return {
    route_path,
    func_name: name,
  };
}
