import "dotenv/config";

import qs from "querystring";
import path from "path";
import { promisify } from "util";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import session from "express-session";
import Twitter from "twitter";

import r from "request";

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

      res.redirect("/me");
    })
    .catch(next);
});

app.get("/me", (req, res, next) => {
  const { user } = req.session;

  if (!user) return next(new Error("No user session"));

  const client = new Twitter({
    consumer_key: TWITTER_API_KEY,
    consumer_secret: TWITTER_API_SECRET_KEY,
    access_token_key: user.oauth_token,
    access_token_secret: user.oauth_token_secret
  });

  const params = { screen_name: user.screen_name };

  return client
    .get("statuses/user_timeline", params)
    .then(tweets => {
      res.send({ tweets });
    })
    .catch(next);
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
