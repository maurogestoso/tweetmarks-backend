import Favorite from "./model";
import User from "../users/model";
import { listFavorites } from "../twitter";

export const getFavorites = async (req, res, next) => {
  // TODO
  // get newest_id from user
  // if newest_id -> add to twitter request params
  // else -> don't add to twtter request params

  const { user } = req.session;

  const authUser = await User.findById(user.id);

  const params = { screen_name: user.screen_name };
  if (authUser.newest_id) params.since_id = authUser.newest_id;

  const newFavorites = await listFavorites(req.twitterClient, params);

  // save requested tweets in DB
  await Favorite.create(
    newFavorites.map(f => ({
      user_id: user.id,
      created_at: f.created_at,
      str_id: f.str_id,
      processed: false
    }))
  );

  // TODO
  // save new newest_id

  // respond with top 20 tweets processed=false
  const latestFavorites = await Favorite.find({
    user_id: user.id,
    processed: false
  })
    .sort({ created_at: "desc" })
    .limit(20);

  res.send({ favorites: latestFavorites });
};
