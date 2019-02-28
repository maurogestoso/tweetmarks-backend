import express from "express";
import { getCollections, createCollection } from "./controller";

const router = express.Router();

router.get("/", getCollections);

router.post("/", createCollection);

export default router;
