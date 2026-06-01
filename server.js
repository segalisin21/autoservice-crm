const path = require("node:path");

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const methodOverride = require("method-override");

const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const clientRoutes = require("./routes/clients");
const carRoutes = require("./routes/cars");
const catalogRoutes = require("./routes/catalog");
const orderRoutes = require("./routes/orders");
const adminPayrollRoutes = require("./routes/admin-payroll");
const adminFinanceRoutes = require("./routes/admin-finance");
const journalRoutes = require("./routes/journal");
const expenseRoutes = require("./routes/expenses");
const adminUserRoutes = require("./routes/admin-users");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride("_method"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-insecure-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

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

app.use((req, res) => {
  res.status(404).send("Not found");
});

module.exports = { app };

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Listening on http://localhost:${port}`);
  });
}

