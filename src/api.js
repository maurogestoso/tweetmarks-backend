import express from "express";
import Twitter from "twitter";

import favoritesRouter from "./favorites/router";

const { TWITTER_API_KEY, TWITTER_API_SECRET_KEY } = process.env;

const router = express.Router();

router.use((req, res, next) => {
  const { user } = req.session;

  if (!user || !user.oauth_token) {
    return res.status(401).send();
  }

  req.twitterClient = new Twitter({
    consumer_key: TWITTER_API_KEY,
    consumer_secret: TWITTER_API_SECRET_KEY,
    access_token_key: user.oauth_token,
    access_token_secret: user.oauth_token_secret
  });

  next();
});

router.use("/favorites", favoritesRouter);

router.get("/profile", (req, res, next) => {
  const { user } = req.session;
  const params = { screen_name: user.screen_name };

  return req.twitterClient
    .get("users/show", params)
    .then(profile => {
      res.send({ profile });
    })
    .catch(next);
});

export default router;
