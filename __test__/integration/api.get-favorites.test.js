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

  describe("with a bottom_range and no top_range", () => {
    describe("when there is less than a full page of unseen favorites from Twitter", () => {
      let fromTwitter, fromDb, mockFavorites, initialBottomRange;
      beforeEach(async () => {
        mockFavorites = createMockFavorites(25);
        fromTwitter = mockFavorites.slice(0, 5);
        fromDb = mockFavorites.slice(5);
        listFavorites.mockResolvedValueOnce(fromTwitter);
        initialBottomRange = {
          newest_id: fromDb[0].id_str,
          oldest_id: fromDb[fromDb.length - 1].id_str
        };

        await User.findByIdAndUpdate(testUser._id, {
          bottom_range: initialBottomRange
        });
        await createFavorites(testUser, fromDb);
      });

      test("responds with 20 favorites from Twitter & the DB", async () => {
        const { body } = await authAgent.get("/api/favorites").expect(200);
        expect(body.favorites).toHaveLength(20);

        // The top 5 should be from Twitter
        body.favorites.slice(0, 5).forEach((f, i) => {
          expect(f).toHaveProperty("id_str");
          expect(f.id_str).toBe(fromTwitter[i].id_str);
        });

        // The bottom 15 should be the top 15 from the DB
        body.favorites.slice(5).forEach((f, i) => {
          expect(f).toHaveProperty("id_str");
          expect(f.id_str).toBe(fromDb[i].id_str);
        });
      });

      test("calls the twitter API with the correct since_id", async () => {
        const expectedSinceId = (await User.findById(testUser._id)).bottom_range
          .newest_id;
        await authAgent.get("/api/favorites").expect(200);
        const [, params] = listFavorites.mock.calls[0];
        expect(params).toEqual({
          screen_name: testUser.screen_name,
          since_id: expectedSinceId
        });
      });

      test("saves the new favorites in the database", async () => {
        await authAgent.get("/api/favorites").expect(200);
        const savedFavorites = await Favorite.find({
          user_id: testUser._id,
          processed: false
        })
          .sort("-created_at")
          .lean();

        expect(savedFavorites).toHaveLength(mockFavorites.length);
        savedFavorites.forEach((fav, i) => {
          expect(fav.processed).toBe(false);
          expect(fav.user_id).toEqual(testUser._id);
          expect(fav.id_str).toBe(mockFavorites[i].id_str);
        });
      });

      test("updates the bottom_range newest_id", async () => {
        await authAgent.get("/api/favorites").expect(200);
        const { bottom_range, top_range } = await User.findById(
          testUser._id
        ).lean();
        expect(bottom_range).toEqual({
          newest_id: fromTwitter[0].id_str,
          oldest_id: initialBottomRange.oldest_id
        });

        expect(top_range).toEqual({
          newest_id: null,
          oldest_id: null
        });
      });
    });

    describe("when there is more than a full page of unseen favorites from Twitter", () => {});
  });

  describe("with a bottom_range and a top_range", () => {});
});
