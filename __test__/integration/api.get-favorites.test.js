import supertest from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { getAutenticatedAgent, createMockFavorites } from "../helpers";
import { listFavorites } from "../../src/twitter";
import User from "../../src/users/model";
import Favorite from "../../src/favorites/model";

jest.mock("../../src/twitter");

const dropFavorites = () => {
  return Favorite.collection.drop().catch(err => {
    if (err.codeName !== "NamespaceNotFound" && err.code !== 26) {
      throw err;
    }
});
};

let authAgent, testUser;
beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    const { agent, user } = await getAutenticatedAgent();
    authAgent = agent;
    testUser = user;
});

beforeEach(async () => {
  listFavorites.mockReset();
    await dropFavorites();
});

test("401s for an unauthorised user", () => {
  return supertest(app)
    .get("/api/favorites")
    .expect(401);
});

test("responds with an empty list when there are no favorites to be processed", async () => {
  listFavorites.mockResolvedValueOnce([]);

  const { body } = await authAgent.get("/api/favorites").expect(200);

  expect(body.favorites).toHaveLength(0);
});

test("responds with favorites from Twitter when the user hasn't fetched before", async () => {
  // user has no newest_id or oldest_id
  // user has no favorites to be processed in db
  // all favorites received come directly from Twitter
  const mockFavorites = createMockFavorites(5);

  listFavorites.mockResolvedValueOnce(mockFavorites);

  const { body } = await authAgent.get("/api/favorites").expect(200);

  expect(body.favorites).toHaveLength(mockFavorites.length);

  const [, params] = listFavorites.mock.calls[0];
  expect(params).toEqual({
    screen_name: testUser.screen_name
  });
});

test("responds with a mix of favorites from Twitter and from the database", async () => {
  const mockFavorites = createMockFavorites(10);
  const mockFavoritesFromTwitter = mockFavorites.slice(0, 5);
  const mockFavoritesFromDatabase = mockFavorites.slice(5);

  listFavorites.mockResolvedValueOnce(mockFavoritesFromTwitter);

  await Favorite.create(
    mockFavoritesFromDatabase.map(f => ({
      str_id: f.str_id,
      created_at: f.created_at,
      user_id: testUser.id,
      processed: false
    }))
  );

  const { body } = await authAgent.get("/api/favorites").expect(200);

  expect(body.favorites).toHaveLength(mockFavorites.length);

  body.favorites.slice(0, 5).forEach((fav, i) => {
    expect(fav.str_id).toBe(mockFavoritesFromTwitter[i].str_id);
  });

  body.favorites.slice(5).forEach((fav, i) => {
    expect(fav.str_id).toBe(mockFavoritesFromDatabase[i].str_id);
  });
});

test("fetches favorites since the last id the user has fetched", async () => {
  const mockId = "mock-id";
  await User.findOneAndUpdate({ _id: testUser.id }, { newest_id: mockId });

  const mockFavorites = createMockFavorites(5);
  listFavorites.mockResolvedValueOnce(mockFavorites);

  await authAgent.get("/api/favorites").expect(200);

  const [, params] = listFavorites.mock.calls[0];
  expect(params).toEqual({
    screen_name: testUser.screen_name,
    since_id: mockId
  });
});

test("sets the user's newest_id to the id of the most recent favorite", async () => {
  const mockFavorites = createMockFavorites(5);
  listFavorites.mockResolvedValueOnce(mockFavorites);

  await authAgent.get("/api/favorites").expect(200);

  const user = await User.findById(testUser.id);

  expect(user.newest_id).toBe(mockFavorites[0].id_str);
});
