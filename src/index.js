import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import r from "request";
import { promisify } from "util";
import qs from "querystring";

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

app.use(morgan("dev"));
app.use(cors());

app.get("/", (req, res) => {
  res.send({
    message: `You just requested ${req.url}`
  });
});

app.get("/sign-in", (req, res, next) => {
  // Step 1: Obtain a request token
  postRequest({
    url: `${TWITTER_API_BASE_URL}/oauth/request_token`,
    oauth: {
      callback: "http://localhost:3000/callback",
      consumer_key: TWITTER_API_KEY,
      consumer_secret: TWITTER_API_SECRET_KEY
    }
  })
    .then(response => {
      res.send(qs.parse(response.body));
    })
    .catch(next);
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
