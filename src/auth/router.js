import express from "express";
import r from "request";
import qs from "querystring";
import { promisify } from "util";
import User from "../users/model";

const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET_KEY,
  TWITTER_CALLBACK,
  FRONTEND_BASE_URL
} = process.env;

const TWITTER_API_BASE_URL = "https://api.twitter.com";

const postRequest = promisify(r.post);

const router = express.Router();

router.get("/", (req, res, next) => {
  const { user } = req.session;

  if (!user || !user.oauth_token) {
    return res.status(401).send();
  }

  res.send();
});

router.get("/sign-in", (req, res, next) => {
  return postRequest({
    url: `${TWITTER_API_BASE_URL}/oauth/request_token`,
    oauth: {
      callback: TWITTER_CALLBACK,
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

router.get("/callback", async (req, res, next) => {
  try {
    const twitterResponse = await postRequest({
      url: `${TWITTER_API_BASE_URL}/oauth/access_token`,
      oauth: {
        verifier: req.query.oauth_verifier,
        token: req.query.oauth_token
      }
    });

    const { oauth_token, oauth_token_secret, user_id, screen_name } = qs.parse(
      twitterResponse.body
    );

    let user = await User.findOne({ screen_name });

    if (!user) {
      user = await new User({ screen_name, user_id }).save();
    }

    req.session.user = {
      screen_name,
      user_id,
      oauth_token,
      oauth_token_secret,
      id: user._id // TODO: change this to _id
    };

    return res.redirect(`${FRONTEND_BASE_URL}/home`);
  } catch (err) {
    return next(err);
  }
});

export default router;
