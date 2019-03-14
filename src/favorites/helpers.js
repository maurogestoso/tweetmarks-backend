import Range from "../ranges/model";
import Favorite from "./model";
import { saveFavoritesAndRange } from "../helpers";
import { listFavorites } from "../twitter";

const TWITTER_FETCH_SIZE = 20;

// TODO: test this helper
export const findOlderFavoritesInRange = async favorite => {
  const { created_at } = favorite;

  // Find the range in which the Tweet falls
  const r = await Range.findOne({
    start_time: {
      $gte: created_at
    },
    end_time: {
      $lte: created_at
    }
  });

  if (r) {
    return await Favorite.find({
      created_at: {
        $lt: created_at,
        $gte: r.end_time
      }
    })
      .sort("-created_at")
      .limit(20);
  } else {
    throw new Error(
      `Tweet with id_str ${favorite.id_str} does not fall in a range`
    );
  }
};

/**
 * Finds and saves to the DB Tweets from Twitter that are older than before_id and newer than since_id
 * Also saves a new Range in the DB.
 * //TODO: Should it extend the ranges, actually?
 * @param {string} before_id
 * @param {string} since_id
 */
export const fetchFavesFromTwitterBetween = async (
  req,
  before_id,
  since_id
) => {
  const { user: sessionUser } = req.session;
  const twitterParams = {
    screen_name: sessionUser.screen_name,
    count: TWITTER_FETCH_SIZE
  };

  twitterParams.max_id = before_id;
  if (since_id) twitterParams.since_id = since_id;

  // Find Tweets from Twitter that are newer than the prevRange, but older than
  // the last Tweet we have
  const favoritesFromTwitter = await listFavorites(
    req.twitterClient,
    twitterParams
  );

  if (!favoritesFromTwitter.length) return [];

  const res = await saveFavoritesAndRange(
    { _id: sessionUser.id },
    favoritesFromTwitter
  );
  return res.favorites;
};

export const findAllFavoritesInRange = async (sessionUser, range) => {
  return await Favorite.find({
    created_at: {
      $gte: range.start_time,
      $lte: range.end_time
    },
    user_id: sessionUser.id
  });
};
