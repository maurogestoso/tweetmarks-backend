import mongoose from "mongoose";
import { saveFavorites } from "../../../src/favorites/helpers";
import Favorite from "../../../src/favorites/model";
import { createMockFavorites, dropFavorites } from "../../helpers";

let mockFavorites, mockUser;
beforeAll(async () => {
  await mongoose.connect(process.env.DATABASE_URI, { useNewUrlParser: true });
  mockFavorites = createMockFavorites(10);
  mockUser = {
    id: mongoose.Types.ObjectId()
  };
});

beforeEach(async () => {
  await dropFavorites();
});

test("returns an empty array if no favorites are passed", async () => {
  const savedFavorites = await saveFavorites(mockUser, []);

  expect(savedFavorites).toEqual([]);
});

test("saves nothing to the DB if no favorites are passed", async () => {
  await saveFavorites(mockUser, []);

  const savedFavorites = await Favorite.find();
  expect(savedFavorites).toEqual([]);
});

test("returns the saved favorites", async () => {
  const savedFavorites = await saveFavorites(mockUser, mockFavorites);

  savedFavorites.forEach((fav, i) => {
    expect(fav.user_id.toString()).toBe(mockUser.id.toString());
    expect(fav.id_str).toBe(mockFavorites[i].id_str);
    expect(fav.processed).toBe(false);
  });
});

test("saves the correct Favorite documents in the DB", async () => {
  await saveFavorites(mockUser, mockFavorites);

  const savedFavorites = await Favorite.find().sort("-created_at");
  savedFavorites.forEach((fav, i) => {
    expect(fav.user_id.toString()).toBe(mockUser.id.toString());
    expect(fav.id_str).toBe(mockFavorites[i].id_str);
    expect(fav.processed).toBe(false);
  });
});
