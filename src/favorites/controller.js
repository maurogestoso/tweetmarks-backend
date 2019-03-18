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

const DEFAULT_PAGE_SIZE = 20;

export const getFavorites = async (req, res, next) => {
  const {
    twitterClient,
    session: { user },
    query: { before_id }
  } = req;

  try {
    const favorites = before_id
      ? await findOlderFavorites(req)
      : await findLatestFavorites({ twitterClient, user });

    res.send({ favorites });
  } catch (err) {
    next(err);
  }
};

const findLatestFavorites = async ({
  twitterClient,
  user,
  pageSize = DEFAULT_PAGE_SIZE
}) => {
  const favorites = [];

  while (favorites.length < pageSize) {
    const batch = await getNextBatch({
      user,
      twitterClient,
      oldestFavorite: favorites[favorites.length - 1],
      pageSize
    });

    favorites.push(...batch);

    if (favorites.length === 0) return favorites;

    const veryLastRange = await Range.findOne({
      user_id: user.id,
      is_last: true
    });

    if (favorites.length < pageSize && veryLastRange) {
      // this means that there are no more favorites to fetch (reached the bottom of the favorites history)
      return favorites;
    }
  }

  // respond
  return favorites.slice(0, 20);
};

/**
 * Returns the newest available favorites in Twitter plus the favorites corresponding to the most recent range in the DB:
 *
 * If passed no oldestFavorite:
 * 1- Get the newest range from the DB
 * 2- Fetch favorites from Twitter since the newest favorite in the DB
 * 3- Save the range of favorites from Twitter in the DB
 * 4- Return the newest 20 favorites from the DB
 *
 * If passed an oldestFavorite:
 * 1- Get the newest range from the DB older than oldestFavorite
 * 2- Fetch favorites from Twitter older than oldestFavorite but newer than the newest favorite in the range
 * 3- Save the range of favorites from Twitter in the DB
 * 4- Return the newest 20 favorites from the DB
 *
 * @param {Object} params an object with properties:
 *      * sessionUser
 *      * twitterClient
 *      * oldestFavorite [optional]
 */
const getNextBatch = async ({
  user,
  twitterClient,
  oldestFavorite,
  pageSize = 20
}) => {
  const topRange = await getNewestRangeSince(user, oldestFavorite);

  const twitterParams = {
    screen_name: user.screen_name,
    count: pageSize,
    max_id: oldestFavorite ? oldestFavorite.id_str : undefined,
    since_id: topRange ? topRange.start_id : undefined
  };

  // Fetch as many as possible from Twitter
  const twitterFavorites = await listFavorites(twitterClient, twitterParams);
  await saveRange(user, twitterFavorites, twitterParams);
  await saveFavorites(user, twitterFavorites);

  // Get the last 20 from DB, only more recent than the end of the top range
  const query = {
    user_id: user.id,
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
    .limit(pageSize);
};

const findOlderFavorites = async req => {
  // TODO: refactor to destructured parameters
  const { user: sessionUser } = req.session;
  const { before_id } = req.query;

  const topFavorite = await Favorite.findOne({
    user_id: sessionUser.id,
    id_str: before_id
  });

  const favorites = [];
  const olderFavesInRange = await findOlderFavoritesInRange(topFavorite);
  if (olderFavesInRange.length) {
    favorites.push(...olderFavesInRange);
  }

  while (favorites.length < DEFAULT_PAGE_SIZE) {
    const oldestCurrentFave =
      favorites.length === 0 ? topFavorite : favorites[favorites.length - 1];

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

  return favorites.slice(0, DEFAULT_PAGE_SIZE);
};

const getNewestRangeSince = async (sessionUser, oldestFavorite) => {
  return oldestFavorite
    ? (await Range.find({
        user_id: sessionUser.id,
        start_time: { $lt: oldestFavorite.created_at }
      })
        .sort("-start_time")
        .limit(1))[0]
    : (await Range.find({ user_id: sessionUser.id })
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
