import Favorite from "./model";
import Range from "../ranges/model";
import { listFavorites } from "../twitter";
import {
  findOlderFavoritesInRange,
  findAllFavoritesInRange,
  fetchFavesFromTwitterBetween,
  saveFavorites,
  saveRange
} from "./helpers";

const PAGE_SIZE = 20;
const TWITTER_FETCH_SIZE = 20;

export const getFavorites = async (req, res) => {
  const { user: sessionUser } = req.session;

  if (req.query.before_id) {
    try {
      const favorites = await findTweetsOlderThan(req);
      return res.status(200).send({ favorites });
    } catch (e) {
      console.log(e);
      return res.status(500).send({ error: e });
    }
  } else {
    const favorites = [];

    while (favorites.length < PAGE_SIZE) {
      const oldestFavorite = favorites.length
        ? favorites[favorites.length - 1]
        : null;
      const batch = await getNextBatch(req, oldestFavorite);
      favorites.push(...batch);

      // No favorites found on Twitter
      if (favorites.length === 0) {
        return res.status(200).send({ favorites: batch });
      }

      const veryLastRange = await Range.findOne({
        user_id: sessionUser.id,
        is_last: true
      });

      if (favorites.length < PAGE_SIZE && veryLastRange) {
        // this means that there are no more favorites to fetch (reached the bottom of the favorites history)
        return res.status(200).send({ favorites });
      }
    }

    // respond
    return res.status(200).send({ favorites: favorites.slice(0, 20) });
  }
};

/**
 * Returns up to PAGE_SIZE Tweets, from Twitter or the DB.
 *
 * When not passed an oldestFavorite it will assume that it should fetch the newest
 * tweets it can from Twitter which are newer than the newest range in the DB,
 * supplemented by further Tweets from the DB to make up the PAGE_SIZE if required, and available.
 *
 * When passed an oldestFavorite, it will query Twitter for any Tweets newer than the
 * given Favorite. Again, the returned tweets will be supplemented by further older Tweets
 * from the DB to make up the PAGE_SIZE if required, and available.
 *
 * @param {Object} req The request object
 * @param {Favorite} [oldestFavorite] The favorite after which the function should return Favorites
 */
const getNextBatch = async (req, oldestFavorite) => {
  const { user: sessionUser } = req.session;
  const { twitterClient } = req;
  const topRange = await getNewestRangeSince(sessionUser, oldestFavorite);

  const twitterParams = {
    screen_name: sessionUser.screen_name,
    count: TWITTER_FETCH_SIZE,
    max_id: oldestFavorite ? oldestFavorite.id_str : undefined,
    since_id: topRange ? topRange.start_id : undefined
  };

  // Fetch as many as possible from Twitter
  const twitterFavorites = await listFavorites(twitterClient, twitterParams);
  await saveRange(sessionUser, twitterFavorites, twitterParams);
  await saveFavorites(sessionUser, twitterFavorites);

  // Get the last 20 from DB, only more recent than the end of the top range
  const query = {
    user_id: sessionUser.id,
    processed: false
  };

  if (topRange) {
    query.created_at = {
      $gte: topRange.end_time
    };
  }

  if (oldestFavorite) {
    query.created_at = {
      ...query.created_at,
      $lte: twitterFavorites[0].created_at
    };
  }

  return await Favorite.find(query)
    .sort("-created_at")
    .limit(PAGE_SIZE);
};

const findTweetsOlderThan = async req => {
  const { user: sessionUser } = req.session;
  const { before_id } = req.query;

  const f = await Favorite.findOne({
    user_id: sessionUser.id,
    id_str: before_id
  });

  const favorites = [];
  const olderFavesInRange = await findOlderFavoritesInRange(f);
  if (olderFavesInRange.length) {
    favorites.push(...olderFavesInRange);
  }

  while (favorites.length < PAGE_SIZE) {
    const oldestCurrentFave =
      favorites.length === 0 ? f : favorites[favorites.length - 1];

    // what was the range before this one?
    const prevRange = await Range.findOne({
      user_id: sessionUser.id,
      start_time: {
        $lt: oldestCurrentFave.created_at
      }
    });

    const fromTwitter = await fetchFavesFromTwitterBetween(
      req,
      oldestCurrentFave.id_str,
      prevRange ? prevRange.start_id : null
    );
    favorites.push(...fromTwitter);
    // If there was no prev range, just return what we have now
    if (!prevRange) {
      break;
      // Fetch favorites from within the previous range
    } else {
      const favesFromRange = await findAllFavoritesInRange(
        sessionUser,
        prevRange
      );
      favorites.push(...favesFromRange);
    }
  }

  return favorites.slice(0, PAGE_SIZE);
};

const getNewestRangeSince = async (user, oldestFavorite) => {
  return oldestFavorite
    ? (await Range.find({
        user_id: user.id,
        start_time: { $lt: oldestFavorite.created_at }
      })
        .sort("-start_time")
        .limit(1))[0]
    : (await Range.find({ user_id: user.id })
        .sort("-start_time")
        .limit(1))[0];
};

export const updateFavorite = async (req, res) => {
  const favoriteId = req.params.id;

  const updates = {};
  if (req.body.processed !== undefined) {
    updates.processed = req.body.processed;
  }
  if (req.body.collection_id !== undefined) {
    updates.collection_id = req.body.collection_id;
    updates.processed = true;
  }

  try {
    const favorite = await Favorite.findByIdAndUpdate(favoriteId, updates);
    if (favorite === null) {
      return res.status(404).send();
    }

    return res.status(200).end();
  } catch (e) {
    if (e.name === "CastError") {
      res.status(400);
      if (e.path === "_id") {
        return res.send({ message: "id parameter is invalid" });
      } else if (e.path === "collection_id") {
        return res.send({ message: "collection_id is invalid" });
      }
    }

    return res.status(500).send({ message: "Something went wrong" });
  }
};
