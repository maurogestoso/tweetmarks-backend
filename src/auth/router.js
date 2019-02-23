import express from "express";

const router = express.Router();

router.get("/", (req, res, next) => {
  const { user } = req.session;

  if (!user || !user.oauth_token) {
    return res.status(401).send();
  }

  res.send();
});

export default router;
