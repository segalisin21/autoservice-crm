const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.DISABLE_LOGIN_RATE_LIMIT === "1",
  handler(_req, res) {
    return res.status(429).render("login", { error: "Слишком много попыток входа. Попробуйте через 15 минут." });
  }
});

module.exports = { loginLimiter };
