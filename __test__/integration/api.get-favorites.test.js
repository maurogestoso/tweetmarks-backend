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

      const {
        body: { favorites }
      } = await authAgent.get("/api/favorites").expect(200);

      expect(favorites).toHaveLength(0);
    });
  });

  describe("when 20 unseen favorites are fetched from Twitter", () => {
    let mockFavorites;
    beforeAll(() => {
      mockFavorites = createMockFavorites(20);
    });

    beforeEach(() => {
      listFavorites.mockResolvedValueOnce(mockFavorites);
    });

    test("responds with 20 most recent from Twitter", async () => {
      const {
        body: { favorites }
      } = await authAgent.get("/api/favorites").expect(200);

      expect(favorites).toHaveLength(mockFavorites.length);
      favorites.forEach((fav, i) => {
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
      await authAgent.get("/api/favorites").expect(200);

      const [range] = await Range.find({ user_id: testUser._id })
        .sort("-start_time")
        .limit(1);

      const topMockFavorite = mockFavorites[0];
      const bottomMockFavorite = mockFavorites[mockFavorites.length - 1];

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
        listFavorites
          .mockResolvedValueOnce(mockFavorites)
          .mockResolvedValueOnce([]);
      });

      test("responds with 5 favorites fetched from Twitter", async () => {
        const {
          body: { favorites }
        } = await authAgent.get("/api/favorites").expect(200);

        expect(favorites).toHaveLength(mockFavorites.length);
        favorites.forEach((fav, i) => {
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
        await authAgent.get("/api/favorites").expect(200);

        const [range] = await Range.find({ user_id: testUser._id })
          .sort("-start_time")
          .limit(1);
        const topMockFavorite = mockFavorites[0];
        const bottomMockFavorite = mockFavorites[mockFavorites.length - 1];

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
        const {
          body: { favorites }
        } = await authAgent.get("/api/favorites").expect(200);
        expect(favorites).toHaveLength(20);

        favorites.forEach((fav, i) => {
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
        await authAgent.get("/api/favorites").expect(200);

        const [range] = await Range.find({ user_id: testUser._id })
          .sort("-start_time")
          .limit(1);
        const topMockFavorite = twitterFavorites[0];
        const bottomMockFavorite =
          twitterFavorites[twitterFavorites.length - 1];

        expect(range.start_id).toBe(topMockFavorite.id_str);
        expect(range.start_time).toEqual(topMockFavorite.created_at);
        expect(range.end_id).toBe(bottomMockFavorite.id_str);
        expect(range.end_time).toEqual(bottomMockFavorite.created_at);
      });
    });

    describe("when there is more data in the DB but not enough to fill a page", () => {
      let mockFavorites,
        twitterFavorites1,
        twitterFavorites2,
        dbFavorites,
        topRange;

      beforeAll(() => {
        mockFavorites = createMockFavorites(30);
        twitterFavorites1 = mockFavorites.slice(0, 5);
        dbFavorites = mockFavorites.slice(5, 10);
        twitterFavorites2 = mockFavorites.slice(10);
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

        listFavorites
          .mockResolvedValueOnce(twitterFavorites1)
          .mockResolvedValueOnce(twitterFavorites2);
      });

      test("responds with data from Twitter (fetched twice) and the DB", async () => {
        const {
          body: { favorites }
        } = await authAgent.get("/api/favorites").expect(200);
        expect(favorites).toHaveLength(20);

        favorites.forEach((fav, i) => {
          expect(fav).toHaveProperty("id_str");
          expect(fav.processed).toBe(false);
          expect(fav.id_str).toBe(mockFavorites[i].id_str);
        });
      });

      test("saves the fetched favorites in the database", async () => {
        await authAgent.get("/api/favorites").expect(200);
        const favesFromDb = await Favorite.find({ user_id: testUser._id }).sort(
          "-created_at"
        );
        expect(favesFromDb).toHaveLength(30);
        favesFromDb.forEach((fav, i) => {
          expect(fav.id_str).toBe(mockFavorites[i].id_str);
        });
      });

      test("requests the Twitter API twice with the correct params", async () => {
        await authAgent.get("/api/favorites").expect(200);

        let [, params] = listFavorites.mock.calls[0];
        expect(params).toHaveProperty("since_id");
        expect(params).toEqual({
          screen_name: testUser.screen_name,
          count: 20,
          since_id: topRange.start_id
        });

        [, params] = listFavorites.mock.calls[1];
        expect(params).toHaveProperty("max_id");
        expect(params).toEqual({
          screen_name: testUser.screen_name,
          count: 20,
          max_id: dbFavorites[dbFavorites.length - 1].id_str
        });
      });

      test("adds the fetched range to the list of ranges", async () => {
        await authAgent.get("/api/favorites").expect(200);
        const ranges = await Range.find({ user_id: testUser._id }).sort(
          "-start_time"
        );
        expect(ranges).toHaveLength(3);
        // The first range which was saved when 1st Twitter results were fetched
        expect(ranges[0].start_id).toBe(twitterFavorites1[0].id_str);
        expect(ranges[0].end_id).toBe(
          twitterFavorites1[twitterFavorites1.length - 1].id_str
        );

        // The range that was already in the DB
        expect(ranges[1].start_id).toBe(dbFavorites[0].id_str);
        expect(ranges[1].end_id).toBe(
          dbFavorites[dbFavorites.length - 1].id_str
        );

        // The range that was created after the second call to Twitter
        expect(ranges[2].start_id).toBe(twitterFavorites2[0].id_str);
        expect(ranges[2].end_id).toBe(
          twitterFavorites2[twitterFavorites2.length - 1].id_str
        );
      });
    });
  });
});

describe("with a before_id query parameter", () => {
  describe("when the before_id falls in a range that is saved in the DB", () => {
    describe("when the range contains enough Tweets to fulfil the request", () => {
      let dbFavorites, initialRange;
      beforeEach(async () => {
        dbFavorites = await saveFavorites(testUser, createMockFavorites(25));
        initialRange = await new Range({
          user_id: testUser._id,
          start_time: dbFavorites[0].created_at,
          start_id: dbFavorites[0].id_str,
          end_time: dbFavorites[dbFavorites.length - 1].created_at,
          end_id: dbFavorites[dbFavorites.length - 1].id_str
        }).save();
      });

      test("returns the tweets from the DB", async () => {
        const beforeId = dbFavorites[0].id_str;
        const expectedFavorites = dbFavorites.slice(1);
        const {
          body: { favorites }
        } = await authAgent
          .get(`/api/favorites?before_id=${beforeId}`)
          .expect(200);

        expect(favorites).toHaveLength(20);
        favorites.forEach((f, i) => {
          expect(f.id_str).toBe(expectedFavorites[i].id_str);
        });
      });

      test("does not modify the ranges in the DB", async () => {
        const beforeId = dbFavorites[0].id_str;
        const ranges = await Range.find({ user_id: testUser._id });
        await authAgent.get(`/api/favorites?before_id=${beforeId}`);

        expect(ranges).toHaveLength(1);
        expect(ranges[0]._id).toEqual(initialRange._id);
      });

      test("makes no calls to Twitter API", async () => {
        const beforeId = dbFavorites[0].id_str;
        await authAgent.get(`/api/favorites?before_id=${beforeId}`);
        expect(listFavorites.mock.calls.length).toBe(0);
      });
    });

    describe("when the range does not contain enough Tweets to fulfil request", () => {
      describe("when there is only the 1 range saved in the DB", () => {
        describe("when enough new Tweets can be fetched from Twitter", () => {
          let dbFavorites, twitterFavorites, range, mockFavorites;
          beforeEach(async () => {
            mockFavorites = createMockFavorites(25);
            dbFavorites = await saveFavorites(
              testUser,
              mockFavorites.slice(0, 5)
            );
            twitterFavorites = mockFavorites.slice(5);
            listFavorites.mockResolvedValueOnce(twitterFavorites);

            range = await new Range({
              user_id: testUser._id,
              start_time: dbFavorites[0].created_at,
              start_id: dbFavorites[0].id_str,
              end_time: dbFavorites[dbFavorites.length - 1].created_at,
              end_id: dbFavorites[dbFavorites.length - 1].id_str
            }).save();
          });

          test("responds with Tweets from the range saved in the DB and extras from Twitter", async () => {
            const beforeId = dbFavorites[0].id_str;

            const { body } = await authAgent
              .get(`/api/favorites?before_id=${beforeId}`)
              .expect(200);
            expect(body.favorites).toHaveLength(20);
          });

          test("saves the new Range in the DB", async () => {
            const beforeId = dbFavorites[0].id_str;
            await authAgent.get(`/api/favorites?before_id=${beforeId}`);
            const ranges = await Range.find({ user_id: testUser._id }).sort(
              "-start_time"
            );
            expect(ranges).toHaveLength(2);
            expect(ranges[0].start_id).toBe(range.start_id);
            expect(ranges[1].start_id).toBe(twitterFavorites[0].id_str);
          });

          test("saves the new Tweets in the DB", async () => {
            const beforeId = dbFavorites[0].id_str;
            await authAgent.get(`/api/favorites?before_id=${beforeId}`);
            const dbFaves = await Favorite.find({ user_id: testUser._id }).sort(
              "-created_at"
            );
            expect(dbFaves).toHaveLength(25);
            dbFaves.forEach((fav, i) => {
              expect(fav).toHaveProperty("id_str");
              expect(fav.id_str).toBe(mockFavorites[i].id_str);
            });
          });
        });

        describe("when no Tweets can be fetched from Twitter", () => {
          let dbFavorites;
          beforeEach(async () => {
            dbFavorites = await saveFavorites(testUser, createMockFavorites(5));
            listFavorites.mockResolvedValueOnce([]);
            await new Range({
              user_id: testUser._id,
              start_time: dbFavorites[0].created_at,
              start_id: dbFavorites[0].id_str,
              end_time: dbFavorites[dbFavorites.length - 1].created_at,
              end_id: dbFavorites[dbFavorites.length - 1].id_str
            }).save();
          });

          test("responds with as many Tweets as exist in the DB", async () => {
            const beforeId = dbFavorites[0].id_str;

            const { body } = await authAgent
              .get(`/api/favorites?before_id=${beforeId}`)
              .expect(200);
            expect(body.favorites).toHaveLength(4);
            body.favorites.forEach((fav, i) => {
              expect(fav).toHaveProperty("id_str");
              expect(fav.id_str).toBe(dbFavorites[i + 1].id_str);
            });
          });
        });

        describe("when neither the DB nor Twitter contain tweets older than before_id", () => {
          let dbFavorites;
          beforeEach(async () => {
            dbFavorites = await saveFavorites(testUser, createMockFavorites(1));
            listFavorites.mockResolvedValueOnce([]);
            await new Range({
              user_id: testUser._id,
              start_time: dbFavorites[0].created_at,
              start_id: dbFavorites[0].id_str,
              end_time: dbFavorites[0].created_at,
              end_id: dbFavorites[0].id_str
            }).save();
          });

          test("responds with an empty array", async () => {
            const beforeId = dbFavorites[0].id_str;
            const { body } = await authAgent
              .get(`/api/favorites?before_id=${beforeId}`)
              .expect(200);
            expect(body.favorites).toHaveLength(0);
          });

          test("calls Twitter with the correct parameters", () => {});
        });

        describe("when not enough extra Tweets can be fetched from Twitter", () => {
          test("responds with however many tweets are available from DB + Twitter", () => {});

          test("saves the new Range in the DB", () => {});

          test("saves the new Tweets in the DB", () => {});
        });
      });

      // describe('when there are no more tweets from Twitter')
      describe("when there are no more tweets from Twitter and no more ranges in the DB", () => {});

      describe("when there are no more tweets from Twitter but  in the DB", () => {});
    });
  });

  describe("when the before_id falls outside of a range", () => {
    describe("when > 20 Tweets are fetched from Twitter", () => {});

    describe("when < 20 tweets returned from Twitter and no more Tweets are in the DB", () => {});

    describe("when < 20 tweets returned from Twitter and more Tweets are in the DB", () => {});
  });
});
