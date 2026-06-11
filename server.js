const path = require("node:path");

require("dotenv").config();

const express = require("express");
const ejs = require("ejs");
const session = require("express-session");
const methodOverride = require("method-override");

const { requireAuth } = require("./middleware/auth");
const { isProbablyPostgresUrl } = require("./config/database");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const clientRoutes = require("./routes/clients");
const carRoutes = require("./routes/cars");
const catalogRoutes = require("./routes/catalog");
const orderRoutes = require("./routes/orders");
const adminPayrollRoutes = require("./routes/admin-payroll");
const adminFinanceRoutes = require("./routes/admin-finance");
const adminReportsRoutes = require("./routes/admin-reports");
const adminSettingsRoutes = require("./routes/admin-settings");
const apiVehiclesRoutes = require("./routes/apiVehicles");
const apiCatalogRoutes = require("./routes/apiCatalog");
const journalRoutes = require("./routes/journal");
const expenseRoutes = require("./routes/expenses");
const adminUserRoutes = require("./routes/admin-users");
const { bootstrapVehicleCatalog } = require("./lib/vehicleCatalogBootstrap");

const app = express();
const { version: pkgVersion } = require("./package.json");

// Railway/Heroku terminate TLS at the edge; required for secure session cookies.
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// Express passes one merged locals object to EJS. A view variable named `client`
// would be copied into compile opts and enable EJS client mode, breaking includes.
app.engine("ejs", (filePath, options, callback) => {
  const viewOptions = {
    cache: options.cache,
    filename: filePath
  };
  if (options.settings?.views) {
    viewOptions.views = options.settings.views;
  }
  const configured = options.settings?.["view options"];
  if (configured) {
    Object.assign(viewOptions, configured);
  }
  ejs.renderFile(filePath, options, viewOptions, callback);
});

app.use((req, res, next) => {
  res.locals.assetVersion = process.env.ASSET_VERSION || `${pkgVersion}.4`;
  next();
});

app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders(res, filePath) {
      if (/\.(js|css)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      }
    }
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride("_method"));

const sessionOptions = {
  secret: process.env.SESSION_SECRET || "dev-insecure-secret",
  resave: false,
  saveUninitialized: false,
  proxy: process.env.NODE_ENV === "production",
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
};

if (isProbablyPostgresUrl(process.env.DATABASE_URL)) {
  const pgSession = require("connect-pg-simple")(session);
  sessionOptions.store = new pgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  });
}

app.use(session(sessionOptions));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(authRoutes);
app.use("/", requireAuth, dashboardRoutes);
app.use("/clients", requireAuth, clientRoutes);
app.use("/cars", requireAuth, carRoutes);
app.use("/catalog", requireAuth, catalogRoutes);
app.use("/orders", requireAuth, orderRoutes);
app.use("/journal", requireAuth, journalRoutes);
app.use("/expenses", requireAuth, expenseRoutes);
app.use("/admin/payroll", requireAuth, adminPayrollRoutes);
app.use("/admin/users", requireAuth, adminUserRoutes);
app.use("/admin", requireAuth, adminFinanceRoutes);
app.use("/admin", requireAuth, adminReportsRoutes);
app.use("/admin", requireAuth, adminSettingsRoutes);
app.use("/api/vehicles", requireAuth, apiVehiclesRoutes);
app.use("/api/catalog", requireAuth, apiCatalogRoutes);

app.use((req, res) => {
  res.status(404).send("Not found");
});

module.exports = { app };

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Listening on http://localhost:${port}`);
    if (process.env.SKIP_VEHICLE_CATALOG !== "1") {
      bootstrapVehicleCatalog();
    }
  });
}

