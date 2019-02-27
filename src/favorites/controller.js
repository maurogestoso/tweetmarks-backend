import Favorite from "./model";
import User from "../users/model";

export const getFavorites = async (req, res, next) => {
  const { user } = req.session;
  const params = { screen_name: user.screen_name, tweet_mode: "extended" };

  try {
    const rawFavorites = await req.twitterClient.get("favorites/list", params);
    const favorites = rawFavorites.map(fav => ({
      id_str: fav.id_str,
      created_at: fav.created_at,
      user_id: user.id
    }));

    await Favorite.create(favorites);

    const favoritesToSend = await Favorite.find(
      { user_id: user.id },
      { id_str: true, created_at: true, processed: true, _id: false }
    )
      .sort({ created_at: "desc" })
      .limit(20)
      .exec();

    res.send({ favorites: favoritesToSend });

    await User.findByIdAndUpdate(user.id, {
      newest_id: favoritesToSend[0].id_str,
      oldest_id: favoritesToSend[favoritesToSend.length - 1].id_str
    });
  } catch (err) {
    return next(err);
  }
};
