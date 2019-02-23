import "dotenv/config";
import supertest from "supertest";
import app from "../../src/app";
import request from "request";

const TWITTER_API_BASE_URL = "https://api.twitter.com";

const { FRONTEND_BASE_URL } = process.env;

const OAUTH_TOKEN = "mock_token";
const OAUTH_VERIFIER = "mock_verifier";

jest.mock("request");

request.post.mockImplementation((params, respond) => {
  const body = [
    `oauth_token=${OAUTH_TOKEN}`,
    `oauth_token_secret=mock_token_secret`,
    `screen_name=CuriousMau`,
    `user_id=123`
  ].join("&");
  respond(null, { body });
});

beforeEach(() => {
  request.post.mockClear();
});

test("redirects to the frontend /home endpoint", () => {
  return supertest(app)
    .get(
      `/auth/callback?oauth_token=${OAUTH_TOKEN}&oauth_verifier=${OAUTH_VERIFIER}`
    )
    .expect(302)
    .expect("Location", `${FRONTEND_BASE_URL}/home`);
});

test("makes a POST request to /oauth/access_token with the correct params", () => {
  return supertest(app)
    .get(
      `/auth/callback?oauth_token=${OAUTH_TOKEN}&oauth_verifier=${OAUTH_VERIFIER}`
    )
    .then(() => {
      expect(request.post).toHaveBeenCalledTimes(1);
      const [callParams] = request.post.mock.calls[0];
      expect(callParams).toEqual({
        url: `${TWITTER_API_BASE_URL}/oauth/access_token`,
        oauth: { verifier: OAUTH_VERIFIER, token: OAUTH_TOKEN }
      });
    });
});
