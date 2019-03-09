import Favorite from "./model";
import User from "../users/model";
import { listFavorites } from "../twitter";

const PAGE_SIZE = 20;

export const getFavorites = async (req, res, next) => {
  const { user: sessionUser } = req.session;
  const { twitterClient } = req;
  const dbUser = await User.findById(sessionUser.id);

  // If we have a bottom range but no top, either we've only made 1 request to Twitter, or we've made several but always got less than a full page size (i.e. we weren't missing any Tweets).
  // We fetch Tweets more recent than bottom_range.newest_id
  const twitterParams = { screen_name: sessionUser.screen_name };
  if (dbUser.hasBottomRange() && !dbUser.hasTopRange()) {
    twitterParams.since_id = dbUser.bottom_range.newest_id;
  }

  const favoritesFromTwitter = await listFavorites(
    twitterClient,
    twitterParams
  );

  if (favoritesFromTwitter.length) {
    await saveFavorites(sessionUser, favoritesFromTwitter);

    if (favoritesFromTwitter.length < 20) {
      await User.findByIdAndUpdate(sessionUser.id, {
        $set: {
          bottom_range: {
            newest_id: favoritesFromTwitter[0].id_str,
            oldest_id: dbUser.bottom_range.oldest_id
          }
        }
      });
    } else {
      await User.findByIdAndUpdate(sessionUser.id, {
        $set: {
          bottom_range: {
            newest_id: favoritesFromTwitter[0].id_str,
            oldest_id:
              favoritesFromTwitter[favoritesFromTwitter.length - 1].id_str
          }
        }
      });
    }
  }

  const favoritesFromDb = await Favorite.find({
    user_id: sessionUser.id,
    processed: false
  })
    .limit(20)
    .sort("-created_at");

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
