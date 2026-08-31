function errorHandler(err, req, res, _next) {
  // eslint-disable-next-line no-console
  console.error(err);

  if (res.headersSent) {
    return;
  }

  const wantsJson =
    req.path.startsWith("/api/") ||
    req.get("Accept")?.includes("application/json") ||
    req.get("X-Requested-With") === "XMLHttpRequest";

  if (wantsJson) {
    return res.status(500).json({ error: "Internal server error" });
  }

  return res.status(500).send("Internal server error");
}

module.exports = { errorHandler };
