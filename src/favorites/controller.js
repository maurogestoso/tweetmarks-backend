import Favorite from "./model";
import User from "../users/model";
import { listFavorites } from "../twitter";

const PAGE_SIZE = 20;

export const getFavorites = async (req, res, next) => {
  try {
    const { user } = req.session;
    const { newest_id } = await User.findById(user.id);
    const params = {
      screen_name: user.screen_name,
      since_id: newest_id || undefined
    };
    const favoritesFromTwitter = await listFavorites(req.twitterClient, params);

    await saveFavorites(user, favoritesFromTwitter);

    const favoritesToSend = await Favorite.find({
      user_id: user.id,
      processed: false
    })
      .sort("-created_at")
      .limit(PAGE_SIZE);

    const userUpdates = {};

    if (favoritesFromTwitter.length) {
      userUpdates.newest_id = favoritesFromTwitter[0].id_str;

      // this means that the fetched favorites are the oldest favorites
      if (favoritesToSend.length === favoritesFromTwitter.length) {
        userUpdates.oldest_id =
          favoritesToSend[favoritesToSend.length - 1].id_str;
      }
    }

    if ("newest_id" in userUpdates || "oldest_id" in userUpdates) {
      await User.findByIdAndUpdate(user.id, userUpdates);
    }

    res.send({ favorites: favoritesToSend });
  } catch (err) {
    next(err);
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
