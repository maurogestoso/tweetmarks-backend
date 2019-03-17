import mongoose from "mongoose";
import { saveRange } from "../../../src/favorites/helpers";
import Range from "../../../src/ranges/model";
import { createMockFavorites, dropRanges } from "../../helpers";

let mockFavorites, mockUser;
beforeAll(async () => {
  await mongoose.connect(process.env.DATABASE_URI, { useNewUrlParser: true });
  mockFavorites = createMockFavorites(20);
  mockUser = {
    id: mongoose.Types.ObjectId()
  };
});

beforeEach(async () => {
  await dropRanges();
});

describe("when passed Twitter params with a since_id", () => {
  let mockTwitterParams;
  beforeAll(() => {
    mockTwitterParams = {
      count: 20,
      screen_name: mockUser.screen_name,
      since_id: "123"
    };
  });

  test("returns an empty array if passed no favorites", async () => {
    const favorites = await saveRange(mockUser, [], mockTwitterParams);

    expect(favorites).toEqual([]);
  });

  test("does not save a range if passed no favorites", async () => {
    await saveRange(mockUser, [], mockTwitterParams);

    const savedRange = await Range.findOne();

    expect(savedRange).toBe(null);
  });

  test("returns the passed favorites", async () => {
    const favorites = await saveRange(
      mockUser,
      mockFavorites,
      mockTwitterParams
    );

    expect(favorites).toEqual(mockFavorites);
  });

  test("saves the correct range in the DB", async () => {
    await saveRange(mockUser, mockFavorites, mockTwitterParams);

    const savedRange = await Range.findOne();

    const topFavorite = mockFavorites[0];
    const bottomFavorite = mockFavorites[mockFavorites.length - 1];

    expect(savedRange.start_id).toBe(topFavorite.id_str);
    expect(savedRange.start_time).toEqual(topFavorite.created_at);
    expect(savedRange.end_id).toBe(bottomFavorite.id_str);
    expect(savedRange.end_time).toEqual(bottomFavorite.created_at);
    expect(savedRange.user_id).toEqual(mockUser.id);
  });

  test("sets the is_last field of the saved range to false", async () => {
    await saveRange(mockUser, mockFavorites, mockTwitterParams);

    const savedRange = await Range.findOne();

    expect(savedRange.is_last).toEqual(false);
  });
});

describe("when passed Twitter params without a since_id", () => {
  let mockTwitterParams;
  beforeAll(() => {
    mockTwitterParams = {
      count: 20,
      screen_name: mockUser.screen_name,
      max_id: "123"
    };
  });

  test("sets the is_last field of a range to true if passed less than 20 favorites", async () => {
    await saveRange(mockUser, mockFavorites.slice(0, 10), mockTwitterParams);

    const savedRange = await Range.findOne();

    expect(savedRange.is_last).toEqual(true);
  });

  test("sets the is_last field of a range to false if passed  20 favorites", async () => {
    await saveRange(mockUser, mockFavorites, mockTwitterParams);

    const savedRange = await Range.findOne();

    expect(savedRange.is_last).toEqual(false);
  });
});
