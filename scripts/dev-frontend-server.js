const path = require("path");

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "frontEnd", "public");
const srcDir = path.join(rootDir, "frontEnd", "src");
const frontendPort = Number(process.env.FRONTEND_PORT || 5051);
const backendTarget = process.env.BACKEND_URL || "http://localhost:5000";
const maxPortFallbacks = Number(process.env.FRONTEND_PORT_FALLBACKS || 10);

const proxyOptions = {
  target: backendTarget,
  changeOrigin: true,
  ws: true,
};

app.use(
  createProxyMiddleware({
    ...proxyOptions,
    pathFilter: (pathname) =>
      pathname.startsWith("/api") ||
      pathname.startsWith("/python-api") ||
      pathname.startsWith("/predict"),
  })
);

app.use("/src", express.static(srcDir));
app.use(
  express.static(publicDir, {
    extensions: ["html"],
  })
);

app.get("/", (_req, res) => {
  res.redirect("/admin");
});

function startServer(port, retriesLeft) {
  const server = app.listen(port, () => {
    console.log(`[frontend] http://localhost:${port}`);
    console.log(`[proxy] ${backendTarget}`);
    if (port !== frontendPort) {
      console.warn(
        `[frontend] use http://localhost:${port}/admin (default port ${frontendPort} was busy)`
      );
    }
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE" && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(
        `[frontend] port ${port} is in use, retrying with ${nextPort}...`
      );
      startServer(nextPort, retriesLeft - 1);
      return;
    }
    throw err;
  });
}

startServer(frontendPort, maxPortFallbacks);
