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
    const newFavorites = await listFavorites(req.twitterClient, params);

    await Favorite.create(
      newFavorites.map(
        fav =>
          new Favorite({
            user_id: user.id,
            created_at: fav.created_at,
            id_str: fav.id_str,
            processed: false
          })
      )
    );

    if (newFavorites.length) {
      await User.findByIdAndUpdate(user.id, {
        newest_id: newFavorites[0].id_str
      });
    }

    const latestFavorites = await Favorite.find({
      user_id: user.id,
      processed: false
    })
      .sort("-created_at")
      .limit(PAGE_SIZE);

    res.send({ favorites: latestFavorites });
  } catch (err) {
    next(err);
  }
};
