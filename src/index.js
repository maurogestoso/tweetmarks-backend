import "dotenv/config";

import qs from "querystring";
import path from "path";
import { promisify } from "util";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";

import r from "request";

const postRequest = promisify(r.post);

const {
  PORT = 4000,
  TWITTER_API_KEY,
  TWITTER_API_SECRET_KEY,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_TOKEN_SECRET
} = process.env;

const TWITTER_API_BASE_URL = "https://api.twitter.com";

const app = express();

app.use(express.static(path.join(__dirname, "../public")));
app.use(morgan("dev"));
app.use(cors());
app.use(bodyParser.json());

app.get("/sign-in", (req, res, next) => {
  postRequest({
    url: `${TWITTER_API_BASE_URL}/oauth/request_token`,
    oauth: {
      callback: "http://localhost:3000/callback",
      consumer_key: TWITTER_API_KEY,
      consumer_secret: TWITTER_API_SECRET_KEY
    }
  })
    .then(response => {
      const {
        oauth_token,
        oauth_token_secret,
        oauth_callback_confirmed
      } = qs.parse(response.body);

      if (response.statusCode === 200) {
        res.redirect(
          302,
          `${TWITTER_API_BASE_URL}/oauth/authenticate?oauth_token=${oauth_token}`
        );
      } else {
        next(new Error("Request to /oauth/request_token failed"));
      }
    })
    .catch(next);
});

app.get("/callback", (req, res, next) => {
  const { oauth_token, oauth_verifier } = req.query;

  postRequest({
    url: `${TWITTER_API_BASE_URL}/oauth/access_token`,
    oauth: {
      verifier: oauth_verifier,
      token: oauth_token
    }
  }).then(response => {
    const { oauth_token, oauth_token_secret, user_id, screen_name } = qs.parse(
      response.body
    );
    res.send({ sessionId: "123" });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
