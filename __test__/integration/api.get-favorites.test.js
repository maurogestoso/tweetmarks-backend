import supertest from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { getAutenticatedAgent, createMockFavorites } from "../helpers";
import { listFavorites } from "../../src/twitter";
import User from "../../src/users/model";
import Favorite from "../../src/favorites/model";
import Range from "../../src/ranges/model";

jest.mock("../../src/twitter");

const saveFavorites = (user, favorites) => {
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

const dropRanges = () => {
  return Range.collection.drop().catch(err => {
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
  await dropRanges();
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
  });

  describe("when 20 unseen favorites are fetched from Twitter", () => {
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
        screen_name: testUser.screen_name,
        count: 20
      });
    });

    test("adds the fetched range to the list of ranges", async () => {
      const mockFavorites = createMockFavorites(20);
      const topMockFavorite = mockFavorites[0];
      const bottomMockFavorite = mockFavorites[mockFavorites.length - 1];

      listFavorites.mockResolvedValueOnce(mockFavorites);

      await authAgent.get("/api/favorites").expect(200);

      const [range] = await Range.find({ user_id: testUser._id })
        .sort("-start_time")
        .limit(1);

      expect(range.start_id).toBe(topMockFavorite.id_str);
      expect(range.start_time).toEqual(topMockFavorite.created_at);
      expect(range.end_id).toBe(bottomMockFavorite.id_str);
      expect(range.end_time).toEqual(bottomMockFavorite.created_at);
    });
  });

  describe("when only 5 unseen favorites are fetched from Twitter", () => {
    describe("when there is no more data in the DB", () => {
      let mockFavorites;
      beforeAll(() => {
        mockFavorites = createMockFavorites(5);
      });

      beforeEach(() => {
        listFavorites.mockResolvedValueOnce(mockFavorites);
      });

      test("responds with 5 favorites fetched from Twitter", async () => {
        const { body } = await authAgent.get("/api/favorites").expect(200);
        expect(body.favorites).toHaveLength(mockFavorites.length);

        body.favorites.forEach((fav, i) => {
          expect(fav).toHaveProperty("id_str");
          expect(fav.processed).toBe(false);
          expect(fav.id_str).toBe(mockFavorites[i].id_str);
        });
      });

      test("saves the fetched favorites in the database", async () => {
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
        await authAgent.get("/api/favorites").expect(200);

        const [, params] = listFavorites.mock.calls[0];
        expect(params).toEqual({
          screen_name: testUser.screen_name,
          count: 20
        });
      });

      test("adds the fetched range to the list of ranges", async () => {
        const topMockFavorite = mockFavorites[0];
        const bottomMockFavorite = mockFavorites[mockFavorites.length - 1];

        await authAgent.get("/api/favorites").expect(200);

        const [range] = await Range.find({ user_id: testUser._id })
          .sort("-start_time")
          .limit(1);

        expect(range.start_id).toBe(topMockFavorite.id_str);
        expect(range.start_time).toEqual(topMockFavorite.created_at);
        expect(range.end_id).toBe(bottomMockFavorite.id_str);
        expect(range.end_time).toEqual(bottomMockFavorite.created_at);
      });
    });

    describe("when there is more data in the DB", () => {
      let mockFavorites, twitterFavorites, dbFavorites, topRange;

      beforeAll(() => {
        mockFavorites = createMockFavorites(25);
        twitterFavorites = mockFavorites.slice(0, 5);
        dbFavorites = mockFavorites.slice(5);
      });

      beforeEach(async () => {
        await saveFavorites(testUser, dbFavorites);
        topRange = await new Range({
          user_id: testUser._id,
          start_time: dbFavorites[0].created_at,
          start_id: dbFavorites[0].id_str,
          end_time: dbFavorites[dbFavorites.length - 1].created_at,
          end_id: dbFavorites[dbFavorites.length - 1].id_str
        }).save();

        listFavorites.mockResolvedValueOnce(twitterFavorites);
      });

      test("respond with the 20 most recent favorites from Twitter and DB", async () => {
        const { body } = await authAgent.get("/api/favorites").expect(200);
        expect(body.favorites).toHaveLength(20);

        body.favorites.forEach((fav, i) => {
          expect(fav).toHaveProperty("id_str");
          expect(fav.processed).toBe(false);
          expect(fav.id_str).toBe(mockFavorites[i].id_str);
        });
      });

      test("saves the fetched favorites in the database", async () => {
        await authAgent.get("/api/favorites").expect(200);

        const favoritesFromDatabase = await Favorite.find({
          user_id: testUser._id
        })
          .sort("-created_at")
          .limit(5)
          .lean();

        expect(favoritesFromDatabase).toHaveLength(twitterFavorites.length);
        favoritesFromDatabase.forEach((fav, i) => {
          expect(fav.processed).toBe(false);
          expect(fav.user_id).toEqual(testUser._id);
          expect(fav.id_str).toBe(twitterFavorites[i].id_str);
        });
      });

      test("requests the Twitter API with the correct since_id", async () => {
        await authAgent.get("/api/favorites").expect(200);

        const [, params] = listFavorites.mock.calls[0];
        expect(params).toEqual({
          screen_name: testUser.screen_name,
          count: 20,
          since_id: topRange.start_id
        });
      });

      test("adds the fetched range to the list of ranges", async () => {
        const topMockFavorite = twitterFavorites[0];
        const bottomMockFavorite =
          twitterFavorites[twitterFavorites.length - 1];

        await authAgent.get("/api/favorites").expect(200);

        const [range] = await Range.find({ user_id: testUser._id })
          .sort("-start_time")
          .limit(1);

        expect(range.start_id).toBe(topMockFavorite.id_str);
        expect(range.start_time).toEqual(topMockFavorite.created_at);
        expect(range.end_id).toBe(bottomMockFavorite.id_str);
        expect(range.end_time).toEqual(bottomMockFavorite.created_at);
      });
    });
  });
});
