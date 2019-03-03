export const listFavorites = (client, params) =>
  client.get("favorites/list", params);
