import { listFavorites } from "../../../src/twitter";

const validParams = { screen_name: "mauro", since_id: "123" };

test("calls client.get with 'favorites/list", () => {
  const mockClient = {
    get: jest.fn()
  };

  listFavorites(mockClient, validParams);

  const [endpoint] = mockClient.get.mock.calls[0];

  expect(endpoint).toBe("favorites/list");
});

test("calls client.get with the provided params", () => {
  const mockClient = {
    get: jest.fn()
  };

  listFavorites(mockClient, validParams);

  const [, callParams] = mockClient.get.mock.calls[0];

  expect(callParams).toEqual(validParams);
});

test("throws an error if not passed a screen_name param", () => {
  expect.assertions(1);
  try {
    const { screen_name, ...missingScreenNameParams } = validParams;
    const mockClient = {
      get: jest.fn()
    };

    listFavorites(mockClient, missingScreenNameParams);
  } catch (err) {
    expect(err.message).toBe("Missing screen_name param");
  }
});
