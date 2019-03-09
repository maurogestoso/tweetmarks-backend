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

let authAgent, testUser;
beforeEach(async () => {
  listFavorites.mockReset();
  await dropUsers();
  await dropFavorites();
  const { agent, user } = await getAutenticatedAgent();
  authAgent = agent;
  testUser = user;
});

test("401s for an unauthorised user", () => {
  return supertest(app)
    .get("/api/favorites")
    .expect(401);
});

describe("with no before_id query parameter", () => {
  describe("when there is no data in Twitter", () => {
    test("responds with empty array if there are no favorites in Twitter", async () => {
      listFavorites.mockResolvedValueOnce([]);

      const { body } = await authAgent.get("/api/favorites").expect(200);
      expect(body.favorites).toHaveLength(0);
    });

    test("does not update the bottom range or the top range", async () => {
      listFavorites.mockResolvedValueOnce([]);

      await authAgent.get("/api/favorites").expect(200);

      const { bottom_range, top_range } = await User.findById(
        testUser._id
      ).lean();

      expect(bottom_range).toEqual({
        newest_id: null,
        oldest_id: null
      });

      expect(top_range).toEqual({
        newest_id: null,
        oldest_id: null
      });
    });
  });

  describe("with no top_range or bottom_range", () => {
    test("responds with 20 most recent from Twitter", async () => {
      const mockFavorites = createMockFavorites(20);
      listFavorites.mockResolvedValueOnce(mockFavorites);

      const { body } = await authAgent.get("/api/favorites").expect(200);
      expect(body.favorites).toHaveLength(20);

      body.favorites.forEach((fav, i) => {
        expect(fav).toHaveProperty("id_str");
        expect(fav.processed).toBe(false);
        expect(fav.id_str).toBe(mockFavorites[i].id_str);
      });
    });

    test("saves the fetched favorites in the database", async () => {
      const mockFavorites = createMockFavorites(20);
      listFavorites.mockResolvedValueOnce(mockFavorites);

      await authAgent.get("/api/favorites").expect(200);

      const favoritesFromDatabase = await Favorite.find({})
        .sort("-created_at")
        .lean();

      expect(favoritesFromDatabase).toHaveLength(mockFavorites.length);
      favoritesFromDatabase.forEach((fav, i) => {
        expect(fav.processed).toBe(false);
        expect(fav.user_id).toEqual(testUser._id);
        expect(fav.id_str).toBe(mockFavorites[i].id_str);
      });
    });

    test("requests the Twitter API with no id parameters", async () => {
      const mockFavorites = createMockFavorites(20);
      listFavorites.mockResolvedValueOnce(mockFavorites);

      await authAgent.get("/api/favorites").expect(200);

      const [, params] = listFavorites.mock.calls[0];
      expect(params).toEqual({
        screen_name: testUser.screen_name
      });
    });

    test("updates the bottom range, does not update the top range", async () => {
      const mockFavorites = createMockFavorites(20);
      listFavorites.mockResolvedValueOnce(mockFavorites);

      await authAgent.get("/api/favorites").expect(200);

      const { bottom_range, top_range } = await User.findById(
        testUser._id
      ).lean();

      expect(bottom_range).toEqual({
        newest_id: mockFavorites[0].id_str,
        oldest_id: mockFavorites[mockFavorites.length - 1].id_str
      });

      expect(top_range).toEqual({
        newest_id: null,
        oldest_id: null
      });
    });
  });
});
