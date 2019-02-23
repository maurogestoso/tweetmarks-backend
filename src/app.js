import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";

import authRouter from "./auth/router";
import apiRouter from "./api/router";

const {
  SESSION_SECRET,
  NODE_ENV = "development",
  FRONTEND_BASE_URL
} = process.env;

const app = express();

if (NODE_ENV === "development") app.use(morgan("dev"));

app.use(express.static(path.join(__dirname, "../public")));
app.use(cors({ origin: FRONTEND_BASE_URL, credentials: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true
  })
);

app.use("/api", apiRouter);
app.use("/auth", authRouter);

export default app;
