const http = require("http");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;

const stateHandler = require("../api/state");
const hostActionHandler = require("../api/host-action");
const masterActionHandler = require("../api/master-action");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });

const createResponder = (nodeRes) => {
  let statusCode = 200;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      const body = JSON.stringify(payload);
      nodeRes.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
      });
      nodeRes.end(body);
    },
  };
};

const normalizePublicPath = (requestPath) => {
  if (requestPath === "/") {
    return "index.html";
  }
  const trimmed = requestPath.replace(/^\/+/, "");
  return trimmed || "index.html";
};

const serveStatic = async (requestPath, res) => {
  const publicPath = normalizePublicPath(requestPath);
  const fullPath = path.join(PUBLIC_DIR, publicPath);
  const normalized = path.normalize(fullPath);
  if (!normalized.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  try {
    const stat = await fsp.stat(normalized);
    let filePath = normalized;
    if (stat.isDirectory()) {
      filePath = path.join(normalized, "index.html");
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await fsp.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
    return true;
  } catch (_error) {
    return false;
  }
};

const routeApi = async (req, res, url, body) => {
  const query = Object.fromEntries(url.searchParams.entries());
  const request = {
    method: req.method,
    query,
    body,
  };
  const response = createResponder(res);

  if (url.pathname === "/api/state") {
    await stateHandler(request, response);
    return true;
  }
  if (url.pathname === "/api/host-action") {
    await hostActionHandler(request, response);
    return true;
  }
  if (url.pathname === "/api/master-action") {
    await masterActionHandler(request, response);
    return true;
  }
  return false;
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    let body = {};
    if (req.method === "POST") {
      body = await readJsonBody(req);
    }

    const handledApi = await routeApi(req, res, url, body);
    if (handledApi) {
      return;
    }

    const served = await serveStatic(url.pathname, res);
    if (served) {
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: error.message || "Bad request." }));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Local API dev server running on http://localhost:${PORT}`);
});

