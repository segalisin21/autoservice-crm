function resolveSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      // eslint-disable-next-line no-console
      console.error(
        "FATAL: SESSION_SECRET must be set to at least 32 characters in production. Generate: openssl rand -base64 32"
      );
      process.exit(1);
    }
    return secret;
  }
  return secret || "dev-insecure-secret";
}

module.exports = { resolveSessionSecret };
