import "dotenv/config";
import app from "./app";

const { PORT = 4000 } = process.env;

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
