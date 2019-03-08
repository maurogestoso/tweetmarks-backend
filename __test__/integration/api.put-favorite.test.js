import supertest from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { getAutenticatedAgent, createMockFavorites } from "../helpers";
import { saveFavoritesAndRange } from "../../src/helpers";
import User from "../../src/users/model";
import Favorite from "../../src/favorites/model";

const dropFavorites = () => {
  return Favorite.collection.drop().catch(err => {
    if (err.codeName !== "NamespaceNotFound" && err.code !== 26) {
      throw err;
    }
  });
};

const dropUsers = () => {
  return User.collection.drop().catch(err => {
    if (err.codeName !== "NamespaceNotFound" && err.code !== 26) {
      throw err;
    }
  });
};

beforeAll(async () => {
  await mongoose.connection.dropDatabase();
});

test("401s for an unauthorised user", () => {
  return supertest(app)
    .put("/api/favorites")
    .expect(401);
});

describe("PUT /api/favorites", () => {
  let authAgent;
  let favorites;
  beforeEach(async () => {
    await dropFavorites();
    await dropUsers();
    const { agent, user } = await getAutenticatedAgent();
    authAgent = agent;
    const res = await saveFavoritesAndRange(user, createMockFavorites(2));
    favorites = res.favorites;
  });

  describe("when id parameter is not provided", () => {
    test("responds with 404", async () => {
      const res = await authAgent.put("/api/favorites");
      expect(res.statusCode).toBe(404);
    });
  });

  describe("when id parameter is not a valid ObjectId", () => {
    test("responds with 400 and error message", async () => {
      const res = await authAgent.put("/api/favorites/foo");
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("id parameter is invalid");
    });
  });

  describe("when id is not found", () => {
    test("responds with 404", async () => {
      const res = await authAgent.put(
        "/api/favorites/5c82950748c4ab3579d717a6"
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe("when provided an id parameter", () => {
    test("200s and responds with correct data", async () => {
      const res = await authAgent.put(`/api/favorites/${favorites[0]._id}`);
      expect(res.statusCode).toBe(200);
    });

    test("updates the document's processed property", async () => {
      const res = await authAgent
        .put(`/api/favorites/${favorites[0]._id}`)
        .send({ processed: true });
      expect(res.statusCode).toBe(200);
      const updatedFave = await Favorite.findById(favorites[0]._id);
      expect(updatedFave.processed).toBe(true);
    });

    test("400s if collection_id property is invalid", async () => {
      const res = await authAgent
        .put(`/api/favorites/${favorites[0]._id}`)
        .send({ collection_id: "foo" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("collection_id is invalid");
    });

    test("updates the document's collection_id property", async () => {
      const res = await authAgent
        .put(`/api/favorites/${favorites[0]._id}`)
        .send({ collection_id: "5c8295061da5673579dab6a5" });
      expect(res.statusCode).toBe(200);
      const updatedFave = await Favorite.findById(favorites[0]._id);
      expect(updatedFave.collection_id.toString()).toBe(
        "5c8295061da5673579dab6a5"
      );
      expect(updatedFave.processed).toBe(true);
    });
  });
});
