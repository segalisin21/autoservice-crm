const Tokens = require("csrf");

const tokens = new Tokens();

function isMutatingMethod(method) {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function isCsrfExempt(req) {
  if (process.env.DISABLE_CSRF === "1") return true;
  if (req.path === "/health") return true;
  if (req.path === "/login" && (req.method === "GET" || req.method === "POST")) return true;
  return false;
}

function ensureCsrfSecret(req) {
  if (!req.session) return null;
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = tokens.secretSync();
  }
  return req.session.csrfSecret;
}

function csrfMiddleware(req, res, next) {
  if (isCsrfExempt(req)) {
    res.locals.csrfToken = "";
    return next();
  }

  const secret = ensureCsrfSecret(req);
  if (!secret) {
    res.locals.csrfToken = "";
    return next();
  }

  res.locals.csrfToken = tokens.create(secret);

  if (!isMutatingMethod(req.method)) {
    return next();
  }

  const bodyToken = req.body && req.body._csrf;
  const headerToken = req.get("x-csrf-token") || req.get("csrf-token");
  const token = bodyToken || headerToken;

  if (!token || !tokens.verify(secret, token)) {
    return res.status(403).send("Invalid CSRF token");
  }

  return next();
}

module.exports = { csrfMiddleware };
