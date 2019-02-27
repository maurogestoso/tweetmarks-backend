import express from "express";
import { getFavorites } from "./controller";

const router = express.Router();

router.get("/", getFavorites);

export default router;
