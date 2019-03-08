import express from "express";
import { getFavorites, updateFavorite } from "./controller";

const router = express.Router();

router.get("/", getFavorites);

router.put("/:id", updateFavorite);

export default router;
