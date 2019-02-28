import supertest from "supertest";
import mongoose from "mongoose";
import app from "../../src/app";
import Collection from "../../src/collections/model";
import { getAutenticatedAgent } from "../testHelpers";

let agent, user, collection;

beforeAll(async () => {
  await mongoose.connection.dropDatabase();
  const r = await getAutenticatedAgent();
  agent = r.agent;
  user = r.user;
  collection = await Collection.create(
    new Collection({ name: "my collection", user_id: user._id })
  );
});

test("GET /api/controllers 401s for unauthorized user", () => {
  return supertest(app)
    .get("/api/collections")
    .expect(401);
});

test("GET /api/collections 200s with data for authorized user", () => {
  return agent
    .get("/api/collections")
    .expect(200)
    .then(res => {
      expect(res.body).toHaveProperty("collections");
      expect(res.body.collections[0]).toEqual({
        name: "my collection",
        _id: collection._id.toString()
      });
    });
});

test("POST /api/collections 401s for unauthorized user", () => {
  return supertest(app)
    .post("/api/collections")
    .expect(401);
});

test("POST /api/collections 400s if name key not provided", () => {
  return agent
    .post("/api/collections")
    .expect(400)
    .then(res => {
      expect(res.body.message).toBe("Name is required");
    });
});

test("POST /api/collections 201s when sent valid data", () => {
  return agent
    .post("/api/collections")
    .send({ name: "new collection" })
    .expect(201);
});
