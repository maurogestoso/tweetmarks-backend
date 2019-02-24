import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";
import mongoose from "mongoose";
import createMongoStore from "connect-mongo";

import auth from "./auth/router";
import api from "./api";

const {
  SESSION_SECRET,
  NODE_ENV = "development",
  FRONTEND_BASE_URL,
  DATABASE_URI
} = process.env;

const app = express();

mongoose.connect(DATABASE_URI, { useNewUrlParser: true });
const MongoStore = createMongoStore(session);

if (NODE_ENV === "development") app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "../public")));
app.use(cors({ origin: FRONTEND_BASE_URL, credentials: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
  })
);

app.use("/api", api);
app.use("/auth", auth);

export default app;
