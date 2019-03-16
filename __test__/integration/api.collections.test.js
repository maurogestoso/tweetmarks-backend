import supertest from "supertest";
import mongoose from "mongoose";
import app from "../../src/app";
import Collection from "../../src/collections/model";
import { getAutenticatedAgent } from "../helpers";

let authAgent, testUser;

beforeAll(async () => {
  await mongoose.connection.dropDatabase();
  const { agent, user } = await getAutenticatedAgent();
  authAgent = agent;
  testUser = user;
});

beforeEach(async () => {
  try {
    await Collection.collection.drop("collection");
  } catch (err) {
    if (err.codeName !== "NamespaceNotFound" && err.code !== 26) {
      throw err;
    }
  }
});

describe("GET /api/collections", () => {
  test("401s for an unauthorised user", () => {
    return supertest(app)
      .get("/api/collections")
      .expect(401);
  });

  test("200s with data for authorized user", async () => {
    const testCollection = await Collection.create(
      new Collection({ name: "my collection", user_id: testUser._id })
    );

    const res = await authAgent.get("/api/collections").expect(200);

    expect(res.body).toHaveProperty("collections");
    expect(res.body.collections[0]).toEqual({
      name: "my collection",
      _id: testCollection._id.toString()
    });
  });
});

describe("POST /api/collections ", () => {
  test("401s for an unauthorised user", () => {
    return supertest(app)
      .post("/api/collections")
      .expect(401);
  });

  test("POST /api/collections 400s if name key not provided", () => {
    return authAgent
      .post("/api/collections")
      .expect(400)
      .then(res => {
        expect(res.body.message).toBe("Name is required");
      });
  });

  test("POST /api/collections 201s when sent valid data", () => {
    return authAgent
      .post("/api/collections")
      .send({ name: "new collection" })
      .expect(201);
  });
});

describe("DELETE /api/collections/:id", () => {
  test("401s for an unauthorised user", () => {
    return supertest(app)
      .delete(`/api/collections/${mongoose.Types.ObjectId()}`)
      .expect(401);
  });

  test("DELETE /api/collections/:id 404s for a non-existing collection", () => {
    return authAgent
      .delete(`/api/collections/${mongoose.Types.ObjectId()}`)
      .expect(404);
  });

  test("DELETE /api/collections/:id deletes the specified collection", async () => {
    const testCollection = await Collection.create(
      new Collection({ name: "my collection", user_id: testUser._id })
    );

    await authAgent
      .delete(`/api/collections/${testCollection._id}`)
      .expect(204);

    const result = await Collection.findById(testCollection._id);

    expect(result).toBeNull();
  });

  test("DELETE /api/collections/:id 400s for an invalid collection id", async () => {
    const { body } = await authAgent
      .delete(`/api/collections/undefined`)
      .expect(400);

    expect(body.error.message).toBe("Invalid collection id");
  });
});
