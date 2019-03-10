import Favorite from "./model";
import Range from "../ranges/model";
import { listFavorites } from "../twitter";

const PAGE_SIZE = 20;
const TWITTER_FETCH_SIZE = 20;

export const getFavorites = async (req, res) => {
  if (!req.query.before_id) {
    const favorites = [];
    const batch = await getNextBatch(req, {});

    favorites.push(...batch);
    if (favorites.length === 0) {
      return res.status(200).send({ favorites: batch });
    }

    const rangeCount = await Range.countDocuments({
      user_id: req.session.user.id
    });
    // We only have 1 range; the one we just saved
    if (rangeCount === 1) {
      return res.status(200).send({ favorites: favorites });
    }

    if (favorites.length < PAGE_SIZE) {
      const batch2 = await getNextBatch(req, {
        max_id: batch[batch.length - 1].id_str,
        index: 1,
        oldestFavorite: favorites[favorites.length - 1]
      });
      favorites.push(...batch2);
    }

    // respond
    return res.status(200).send({ favorites: favorites.slice(0, 20) });
  }

  // get the newest range (if exists)
  // Get oldest tweet, is it in the above range?
  // yes, it's IN the range
  // find the overlap
  // Save any new tweets to the DB
  // extend range (later extract to Consolidate_Ranges?)
  // no, it's older than the range
  // save tweets without overwriting
  // Save the new range
  // Later, Consolidate_ranges
  // if no
  // save the tweets to DB
  // save a new range

  // Consolidate ranges
  // This logic takes a start and end of a range, and looks through all the ranges which fall in this period, and consolidates them if it can.
};

const getNextBatch = async (req, { max_id, oldestFavorite }) => {
  const { user: sessionUser } = req.session;
  const { twitterClient } = req;

  // if there is no param
  const twitterParams = {
    screen_name: sessionUser.screen_name,
    count: TWITTER_FETCH_SIZE
  };

  if (max_id) twitterParams.max_id = max_id;
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
      $lt: favoritesFromTwitter[0].created_at
    };
  }

  return await Favorite.find(query)
    .sort("-created_at")
    .limit(PAGE_SIZE);
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
