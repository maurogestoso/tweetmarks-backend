import Favorite from "./model";
import User from "../users/model";
import { listFavorites } from "../twitter";

const PAGE_SIZE = 20;

export const getFavorites = async (req, res, next) => {
  const { user } = req.session;
  const { twitterClient } = req;
  let favoritesFromDb = [];

  const favoritesFromTwitter = await listFavorites(twitterClient, {
    screen_name: user.screen_name
  });

  if (favoritesFromTwitter.length) {
    favoritesFromDb = await saveFavorites(user, favoritesFromTwitter);

    await User.findByIdAndUpdate(user.id, {
      bottom_range: {
        newest_id: favoritesFromTwitter[0].id_str,
        oldest_id: favoritesFromTwitter[favoritesFromTwitter.length - 1].id_str
      }
    });
  }

  res.send({ favorites: favoritesFromDb });
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
