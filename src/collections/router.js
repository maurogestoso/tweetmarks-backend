import express from "express";
import {
  getCollection,
  getCollections,
  createCollection,
  deleteCollection,
  getFavoritesInCollection
} from "./controller";

const router = express.Router();

router.get("/", getCollections);

router.post("/", createCollection);

router.delete("/:collectionId", deleteCollection);

router.get("/:collectionId", getCollection);

router.get("/:collectionId/favorites", getFavoritesInCollection);

export default router;
