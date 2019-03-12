import Favorite from "./model";
import Range from "../ranges/model";
import { listFavorites } from "../twitter";

const PAGE_SIZE = 20;
const TWITTER_FETCH_SIZE = 20;

export const getFavorites = async (req, res) => {
  if (req.query.before_id !== undefined) {
    try {
      const favorites = await findTweetsOlderThan(req);
      return res.status(200).send({ favorites });
    } catch (e) {
      console.log(e);
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

  if (oldestFavorite) twitterParams.max_id = oldestFavorite.max_id;
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
  const { twitterClient } = req;
  const { user: sessionUser } = req.session;

  const twitterParams = {
    screen_name: sessionUser.screen_name,
    count: TWITTER_FETCH_SIZE
  };

  const f = await Favorite.findOne({ id_str: req.query.before_id });
  const { created_at } = f;
  const favorites = [];
  // Does tweet fall in a range?
  const r = await Range.findOne({
    start_time: {
      $gte: created_at
    },
    end_time: {
      $lte: created_at
    }
  });
  if (r) {
    // Find tweets created before the requested Tweet, but within the DB range
    const favesFromRange = await Favorite.find({
      created_at: {
        $lt: created_at,
        $gte: r.end_time
      }
    })
      .sort("-created_at")
      .limit(20);

    if (favesFromRange) favorites.push(...favesFromRange);

    if (favorites.length < PAGE_SIZE && favorites.length > 0) {
      // what was the range before this one?
      const prevRange = await Range.findOne({
        start_time: {
          $lt: favorites[favorites.length - 1].created_at
        }
      });

      // Find Tweets from Twitter that are newer than the prevRange, but older than
      // the last Tweet we have
      twitterParams.max_id = [favorites.length - 1].id_str;
      if (prevRange) twitterParams.since_id = prevRange.start_id;
      const favoritesFromTwitter = await listFavorites(
        twitterClient,
        twitterParams
      );

      favorites.push(...favoritesFromTwitter);
    }
    return favorites.slice(0, PAGE_SIZE);
  }
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
