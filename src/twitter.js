export const listFavorites = (client, params = {}) => {
  if (!params.screen_name) {
    throw new Error("Missing screen_name param");
  }
  return client.get("favorites/list", params);
};
