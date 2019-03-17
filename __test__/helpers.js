import querystring from "querystring";
import supertest from "supertest";
import nock from "nock";
import app from "../src/app";
import User from "../src/users/model";
import Favorite from "../src/favorites/model";
const TOKEN = "123";
const OAUTH_TOKEN = "mock_token";

export const getAutenticatedAgent = async () => {
  nock("https://api.twitter.com")
    .post("/oauth/request_token")
    .reply(200, `oauth_token=${TOKEN}`);
  nock("https://api.twitter.com")
    .post("/oauth/access_token")
    .reply(
      200,
      querystring.stringify({
        oauth_token: OAUTH_TOKEN,
        oauth_token_secret: "foo",
        user_id: 123,
        screen_name: "test_user"
      })
    );

  const agent = supertest.agent(app);
  await agent.get("/auth/sign-in");
  await agent.get("/auth/callback");

  const user = await User.findOne({ screen_name: "test_user" });
  return { agent, user };
};

export const createMockFavorites = num => {
  return Array.from({ length: num }, (v, k) => k).map(i => ({
    id_str: i.toString(),
    created_at: new Date(Date.now() - i * 100000),
    text: "This is a mock tweet"
  }));
};

export const dropFavorites = () => {
  return Favorite.collection.drop().catch(err => {
    if (err.codeName !== "NamespaceNotFound" && err.code !== 26) {
      throw err;
    }
  });
};
