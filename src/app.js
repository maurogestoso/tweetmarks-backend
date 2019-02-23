import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";

import authRouter from "./auth/router";
import apiRouter from "./api/router";

const { PORT = 4000, SESSION_SECRET } = process.env;

const app = express();

app.use(express.static(path.join(__dirname, "../public")));
app.use(morgan("dev"));
app.use(cors());
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
