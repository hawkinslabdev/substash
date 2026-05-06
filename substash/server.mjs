import compression from "compression";
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { handler } from "./dist/server/entry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "dist", "client");
const PORT = process.env.PORT ?? 9456;
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
]);

// Astro hashes all _astro/ filenames — cache forever; everything else 1 h
function cacheControl(file) {
  return file.includes(`${path.sep}_astro${path.sep}`) ||
    file.includes("/_astro/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";
}

async function tryStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    // Block path traversal
    const safe = path.normalize(pathname).replace(/^(?:\.\.\/|\.\.\\)+/, "");
    const file = path.join(CLIENT_DIR, safe);
    if (!file.startsWith(CLIENT_DIR)) return false;

    const info = await stat(file);
    if (!info.isFile()) return false;

    const body = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME.get(ext) ?? "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": cacheControl(file),
    });
    req.method === "HEAD" ? res.end() : res.end(body);
    return true;
  } catch {
    return false;
  }
}

const compress = compression();

const server = createServer(async (req, res) => {
  // Serve dist/client/ assets first; SSR handler picks up everything else
  if (await tryStatic(req, res)) return;
  compress(req, res, () => handler(req, res));
});

server.listen(PORT, HOST, () => {
  console.log(`[substash] http://${HOST}:${PORT}`);
});
