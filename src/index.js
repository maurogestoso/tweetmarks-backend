import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

const app = express();

app.use(morgan("dev"));
app.use(cors());

app.get("/", (req, res) => {
  res.send({
    message: `You just requested ${req.url}`
  });
});

const { PORT = 4000 } = process.env;

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
