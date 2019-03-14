import Favorite from "../favorites/model";
import Range from "../ranges/model";

// TODO: use this function throughout tests & controller to save the range & faves together
export const saveFavoritesAndRange = async (user, faves) => {
  const favorites = await Favorite.create(
    faves.map(
      fav =>
        new Favorite({
          id_str: fav.id_str,
          created_at: fav.created_at,
          user_id: user._id,
          processed: false
        })
    )
  );

  const range = await new Range({
    user_id: user._id,
    start_time: faves[0].created_at,
    start_id: faves[0].id_str,
    end_time: faves[faves.length - 1].created_at,
    end_id: faves[faves.length - 1].id_str
  }).save();
  return {
    favorites,
    range
  };
};
