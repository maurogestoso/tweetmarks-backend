import "dotenv/config";

import qs from "querystring";
import path from "path";
import { promisify } from "util";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";

import r from "request";

import authRouter from "./auth/router";
import apiRouter from "./api/router";

const postRequest = promisify(r.post);

const {
  PORT = 4000,
  TWITTER_API_KEY,
  TWITTER_API_SECRET_KEY,
  SESSION_SECRET
} = process.env;

const TWITTER_API_BASE_URL = "https://api.twitter.com";

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

app.get("/sign-in", (req, res, next) => {
  return postRequest({
    url: `${TWITTER_API_BASE_URL}/oauth/request_token`,
    oauth: {
      callback: "http://localhost:3000/callback", // TODO: calculate programmatically
      consumer_key: TWITTER_API_KEY,
      consumer_secret: TWITTER_API_SECRET_KEY
    }
  })
    .then(twitterResponse => {
      const { oauth_token } = qs.parse(twitterResponse.body);

      res.redirect(
        302,
        `${TWITTER_API_BASE_URL}/oauth/authenticate?oauth_token=${oauth_token}`
      );
    })
    .catch(next);
});

app.get("/callback", (req, res, next) => {
  return postRequest({
    url: `${TWITTER_API_BASE_URL}/oauth/access_token`,
    oauth: {
      verifier: req.query.oauth_verifier,
      token: req.query.oauth_token
    }
  })
    .then(twitterResponse => {
      const {
        oauth_token,
        oauth_token_secret,
        user_id,
        screen_name
      } = qs.parse(twitterResponse.body);

      req.session.user = {
        screen_name,
        user_id,
        oauth_token,
        oauth_token_secret
      };

      res.send({ user: { user_id, screen_name } });
    })
    .catch(next);
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
