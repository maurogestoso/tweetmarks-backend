import express from "express";
import {
  getCollections,
  createCollection,
  deleteCollection
} from "./controller";

const router = express.Router();

router.get("/", getCollections);

router.post("/", createCollection);

router.delete("/:collectionId", deleteCollection);

export default router;
