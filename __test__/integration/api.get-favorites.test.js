import supertest from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { getAutenticatedAgent, createMockFavorites } from "../helpers";
import { listFavorites } from "../../src/twitter";
import User from "../../src/users/model";
import Favorite from "../../src/favorites/model";

jest.mock("../../src/twitter");

const createFavorites = (user, favorites) => {
  return Favorite.create(
    favorites.map(
      fav =>
        new Favorite({
          id_str: fav.id_str,
          created_at: fav.created_at,
          user_id: user._id,
          processed: false
        })
    )
  );
};

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
    .get("/api/favorites")
    .expect(401);
});

describe("GET /api/favorites", () => {
  let authAgent, testUser;
  beforeEach(async () => {
    listFavorites.mockReset();
    await dropFavorites();
    await dropUsers();
    const { agent, user } = await getAutenticatedAgent();
    authAgent = agent;
    testUser = user;
  });

  describe("no favorites in Twitter, no favorites in DB, no newest_id", () => {
    test("responds with an empty list", async () => {
      listFavorites.mockResolvedValueOnce([]);

      const { body } = await authAgent.get("/api/favorites").expect(200);

      expect(body.favorites).toHaveLength(0);
    });
  });

  describe("some favorites in Twitter, no favorites in DB, no newest_id", () => {
    test("responds with the latest favorites from Twitter", async () => {
      const mockFavorites = createMockFavorites(5);
      listFavorites.mockResolvedValueOnce(mockFavorites);

      const { body } = await authAgent.get("/api/favorites").expect(200);

      expect(body.favorites).toHaveLength(mockFavorites.length);
      body.favorites.slice(0, 5).forEach((fav, i) => {
        expect(fav.str_id).toBe(mockFavorites[i].str_id);
      });
    });

    test("updates the user's newest_id", async () => {
      const mockFavorites = createMockFavorites(5);
      const expected_newest_id = mockFavorites[0].id_str;
      listFavorites.mockResolvedValueOnce(mockFavorites);

      await authAgent.get("/api/favorites").expect(200);

      const { newest_id } = await User.findById(testUser._id);
      expect(newest_id).toBe(expected_newest_id);
    });

    test("updates the user's oldest_id field", async () => {
      const mockFavorites = createMockFavorites(5);
      const expected_oldest_id = mockFavorites[mockFavorites.length - 1].id_str;
      listFavorites.mockResolvedValueOnce(mockFavorites);

      await authAgent.get("/api/favorites").expect(200);

      const { oldest_id } = await User.findById(testUser._id);
      expect(oldest_id).toBe(expected_oldest_id);
    });
  });

  describe("some favorites in Twitter, some favorites in DB, set newest_id", () => {
    let mockFavorites,
      twitterFavorites,
      dbFavorites,
      initial_newest_id,
      final_newest_id;

    beforeAll(async () => {
      mockFavorites = createMockFavorites(10);
      twitterFavorites = mockFavorites.slice(0, 5);
      dbFavorites = mockFavorites.slice(5);
      initial_newest_id = dbFavorites[0].id_str;
      final_newest_id = twitterFavorites[0].id_str;
    });

    test("responds with a list of favorites", async () => {
      await User.findByIdAndUpdate(testUser.id, {
        newest_id: initial_newest_id
      });
      await createFavorites(testUser, dbFavorites);
      listFavorites.mockResolvedValueOnce(twitterFavorites);

      const { body } = await authAgent.get("/api/favorites").expect(200);

      expect(body.favorites).toHaveLength(mockFavorites.length);
      body.favorites.slice(0, 5).forEach((fav, i) => {
        expect(fav.str_id).toBe(twitterFavorites[i].str_id);
      });
      body.favorites.slice(5).forEach((fav, i) => {
        expect(fav.str_id).toBe(dbFavorites[i].str_id);
      });
    });

    test("requests the Twitter API with the since_id param equal to the user's newest_id field", async () => {
      await User.findByIdAndUpdate(testUser.id, {
        newest_id: initial_newest_id
      });
      listFavorites.mockResolvedValueOnce(twitterFavorites);

      await authAgent.get("/api/favorites").expect(200);

      const [, params] = listFavorites.mock.calls[0];
      expect(params).toEqual({
        screen_name: testUser.screen_name,
        since_id: initial_newest_id
      });
    });

    test("updates the user's newest_id", async () => {
      await User.findByIdAndUpdate(testUser.id, {
        newest_id: initial_newest_id
      });
      listFavorites.mockResolvedValueOnce(twitterFavorites);

      await authAgent.get("/api/favorites").expect(200);

      const { newest_id } = await User.findById(testUser._id);
      expect(newest_id).toBe(final_newest_id);
    });
  });
});
