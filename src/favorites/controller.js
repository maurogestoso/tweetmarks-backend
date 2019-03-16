import Favorite from "./model";
import Range from "../ranges/model";
import { listFavorites } from "../twitter";
import {
  findOlderFavoritesInRange,
  findAllFavoritesInRange,
  fetchFavesFromTwitterBetween
} from "./helpers";

const PAGE_SIZE = 20;
const TWITTER_FETCH_SIZE = 20;

export const getFavorites = async (req, res) => {
  if (req.query.before_id !== undefined) {
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

      const rangeCount = await Range.countDocuments({
        user_id: req.session.user.id
      });
      // We only have 1 range; the one we just saved - so we've got all the Tweets we possibly could get from Twitter, no point continuing/
      if (rangeCount === 1) {
        return res.status(200).send({ favorites: favorites });
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

  // if there is no param
  const twitterParams = {
    screen_name: sessionUser.screen_name,
    count: TWITTER_FETCH_SIZE
  };

  if (oldestFavorite) twitterParams.max_id = oldestFavorite.id_str;
  // if we have a range, get the newest and use as the since_id
  const topRange = oldestFavorite
    ? (await Range.find({
        user_id: sessionUser.id,
        start_time: { $lt: oldestFavorite.created_at }
      })
        .sort("-start_time")
        .limit(1))[0]
    : (await Range.find({ user_id: sessionUser.id })
        .sort("-start_time")
        .limit(1))[0];

  if (topRange) {
    twitterParams.since_id = topRange.start_id;
  }

  // Fetch as many as possible (up to 20) from Twitter since_id
  const favoritesFromTwitter = await listFavorites(
    twitterClient,
    twitterParams
  );

  if (favoritesFromTwitter.length) {
    // Save a new range
    await new Range({
      user_id: sessionUser.id,
      start_id: favoritesFromTwitter[0].id_str,
      start_time: favoritesFromTwitter[0].created_at,
      end_id: favoritesFromTwitter[favoritesFromTwitter.length - 1].id_str,
      end_time: favoritesFromTwitter[favoritesFromTwitter.length - 1].created_at
    }).save();
  }

  // Save Tweets to DB
  await saveFavorites(sessionUser, favoritesFromTwitter);

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
      $lte: favoritesFromTwitter[0].created_at
    };
  }

  return await Favorite.find(query)
    .sort("-created_at")
    .limit(PAGE_SIZE);
};

const findTweetsOlderThan = async req => {
  const { user: sessionUser } = req.session;
  const { before_id } = req.query;

  const f = await Favorite.findOne({ id_str: before_id });

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

const saveFavorites = (user, favorites) => {
  return Favorite.create(
    favorites.map(
      fav =>
        new Favorite({
          user_id: user.id,
          created_at: fav.created_at,
          id_str: fav.id_str,
          processed: false
        })
    )
  );
};

export const updateFavorite = async (req, res, next) => {
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
