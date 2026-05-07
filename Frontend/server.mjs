import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const cliPort = process.argv.find((value, index) => index > 1 && /^\d+$/.test(value));
const startPort = Number(cliPort || 5173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function resolvePath(urlPath) {
  const path = decodeURIComponent(urlPath.split("?")[0]);
  const safePath = normalize(path).replace(/^(\.\.[/\\])+/, "");
  const filePath = safePath === "/" ? join(rootDir, "index.html") : join(rootDir, safePath);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return filePath;
  }
  return join(rootDir, "index.html");
}

function createAppServer() {
  return createServer((request, response) => {
    const filePath = resolvePath(request.url || "/");
    const ext = extname(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain; charset=utf-8" });
    createReadStream(filePath).pipe(response);
  });
}

function startServer(port) {
  const server = createAppServer();
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" || error.code === "EACCES") {
      startServer(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Static frontend server running at http://127.0.0.1:${port}`);
  });
}

startServer(startPort);
