import { listFavorites } from "../../../src/twitter";
import { createMockFavorites } from "../../helpers";

const validParams = { screen_name: "mauro", since_id: "123" };

describe("parameters validation", () => {
  test("calls client.get with 'favorites/list'", () => {
    const mockClient = {
      get: jest.fn().mockResolvedValue([])
    };

    listFavorites(mockClient, validParams);

    const [endpoint] = mockClient.get.mock.calls[0];

    expect(endpoint).toBe("favorites/list");
  });

  test("calls client.get with the provided params", () => {
    const mockClient = {
      get: jest.fn().mockResolvedValue([])
    };

    listFavorites(mockClient, validParams);

    const [, callParams] = mockClient.get.mock.calls[0];

    expect(callParams).toEqual(validParams);
  });

  test("throws an error if not passed a screen_name param", async () => {
    expect.assertions(1);
    try {
      const missingScreenNameParams = {
        ...validParams,
        screen_name: undefined
      };
      const mockClient = {
        get: jest.fn().mockResolvedValue([])
      };

      await listFavorites(mockClient, missingScreenNameParams);
    } catch (err) {
      expect(err.message).toBe("Missing screen_name param");
    }
  });
});

describe("when Twitter responds with 20 favorites", () => {
  test("responds with 20 favorites", async () => {
    const mockFavorites = createMockFavorites(20);
    const mockClient = {
      get: jest.fn().mockResolvedValueOnce(mockFavorites)
    };

    const favorites = await listFavorites(mockClient, validParams);

    expect(favorites).toEqual(mockFavorites);
  });
});

describe("when Twitter responds each time with < 20 favorites", () => {
  test("responds with the collected favorites from all the calls", async () => {
    const mockFavorites = createMockFavorites(30);
    const since_id = mockFavorites[mockFavorites.length - 1].created_at;
    const mockClient = {
      get: jest.fn()
    };

    mockClient.get
      .mockResolvedValueOnce(mockFavorites.slice(0, 5))
      .mockResolvedValueOnce(mockFavorites.slice(4, 10))
      .mockResolvedValueOnce(mockFavorites.slice(9, 15))
      .mockResolvedValueOnce(mockFavorites.slice(14))
      .mockResolvedValueOnce([]);

    const favorites = await listFavorites(mockClient, {
      ...validParams,
      since_id
    });

    expect(favorites.length).toEqual(mockFavorites.length);
    favorites.forEach((f, i) => {
      expect(f.id_str).toBe(mockFavorites[i].id_str);
      expect(f.created_at).toBe(mockFavorites[i].created_at);
    });
  });

  test("responds with n favorites if less than 20 are possible", async () => {
    const mockFavorites = createMockFavorites(10);
    const since_id = mockFavorites[mockFavorites.length - 1].created_at;
    const mockClient = {
      get: jest.fn()
    };

    mockClient.get
      .mockResolvedValueOnce(mockFavorites.slice(0, 5))
      .mockResolvedValueOnce(mockFavorites.slice(4))
      .mockResolvedValueOnce([]);

    const favorites = await listFavorites(mockClient, {
      ...validParams,
      since_id
    });

    expect(favorites.length).toEqual(10);
    favorites.forEach((f, i) => {
      expect(f.id_str).toBe(mockFavorites[i].id_str);
      expect(f.created_at).toBe(mockFavorites[i].created_at);
    });
  });
});
