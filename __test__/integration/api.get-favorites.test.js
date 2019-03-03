import supertest from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { getAutenticatedAgent, createMockFavorites } from "../helpers";
import { listFavorites } from "../../src/twitter";

jest.mock("../../src/twitter");

let authAgent;

beforeAll(async () => {
  try {
    await mongoose.connection.dropDatabase();

    const { agent } = await getAutenticatedAgent();
    authAgent = agent;
  } catch (err) {
    throw err;
  }
});

test("401s for an unauthorised user", () => {
  return supertest(app)
    .get("/api/favorites")
    .expect(401);
});

test("200s with an empty list when there are no favorites to be processed", async () => {
  listFavorites.mockResolvedValueOnce([]);

  const { body } = await authAgent.get("/api/favorites").expect(200);

  expect(body.favorites).toHaveLength(0);
});

test("200s with favorites from Twitter when the user hasn't fetched before", async () => {
  const mockFavorites = createMockFavorites(5);

  listFavorites.mockResolvedValueOnce(mockFavorites);

  const { body } = await authAgent.get("/api/favorites").expect(200);
  expect(body.favorites).toHaveLength(mockFavorites.length);

  body.favorites.forEach(fav => {
    expect(fav.processed).toBeFalsy();
  });
});
