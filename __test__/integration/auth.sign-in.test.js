import supertest from "supertest";
import app from "../../src/app";
import request from "request";

const TWITTER_API_BASE_URL = "https://api.twitter.com";

const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET_KEY,
  TWITTER_CALLBACK
} = process.env;

jest.mock("request");

const TOKEN = "123";
request.post.mockImplementation((params, respond) => {
  respond(null, {
    body: `oauth_token=${TOKEN}`
  });
});

test("makes a POST request to /oauth/request_token with the correct params", () => {
  return supertest(app)
    .get("/auth/sign-in")
    .then(() => {
      expect(request.post).toHaveBeenCalledTimes(1);
      const [callParams] = request.post.mock.calls[0];
      expect(callParams).toEqual({
        url: `${TWITTER_API_BASE_URL}/oauth/request_token`,
        oauth: {
          callback: TWITTER_CALLBACK,
          consumer_key: TWITTER_API_KEY,
          consumer_secret: TWITTER_API_SECRET_KEY
        }
      });
    });
});

test("redirects to /oauth/request_token with the correct params", () => {
  return supertest(app)
    .get("/auth/sign-in")
    .expect(302)
    .expect(
      "Location",
      `https://api.twitter.com/oauth/authenticate?oauth_token=${TOKEN}`
    );
});

test("responds with a session cookie", () => {
  return supertest(app)
    .get("/auth/sign-in")
    .expect("set-cookie", /connect\.sid=.+/);
});
