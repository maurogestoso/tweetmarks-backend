import supertest from "supertest";
import mongoose from "mongoose";
import app from "../../src/app";
import Collection from "../../src/collections/model";
import { getAutenticatedAgent } from "../helpers";

let authAgent, testUser, testCollection;

beforeAll(async () => {
  await mongoose.connection.dropDatabase();
  const { agent, user } = await getAutenticatedAgent();
  authAgent = agent;
  testUser = user;
  testCollection = await Collection.create(
    new Collection({ name: "my collection", user_id: testUser._id })
  );
});

test("GET /api/controllers 401s for unauthorized user", () => {
  return supertest(app)
    .get("/api/collections")
    .expect(401);
});

test("GET /api/collections 200s with data for authorized user", () => {
  return authAgent
    .get("/api/collections")
    .expect(200)
    .then(res => {
      expect(res.body).toHaveProperty("collections");
      expect(res.body.collections[0]).toEqual({
        name: "my collection",
        _id: testCollection._id.toString()
      });
    });
});

test("POST /api/collections 401s for unauthorized user", () => {
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
