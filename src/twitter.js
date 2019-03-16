export const listFavorites = async (client, params = {}) => {
  if (!params.screen_name) {
    throw new Error("Missing screen_name param");
  }

  const meFaves = [];
  let stillFetching = true;
  while (meFaves.length < 20 && stillFetching) {
    if (meFaves.length) {
      params.max_id = meFaves[meFaves.length - 1].id_str;
    }
    const favorites = await client.get("favorites/list", params);
    if (favorites.length === 0) stillFetching = false;
    if (params.max_id) {
      meFaves.push(...favorites.slice(1));
    } else {
      meFaves.push(...favorites);
    }
  }

  return meFaves.slice(0, 20);
};
