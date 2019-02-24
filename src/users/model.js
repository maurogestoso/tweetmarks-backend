import mongoose from "mongoose";

const schema = new mongoose.Schema({
  screen_name: String,
  user_id: String
});

export default mongoose.model("user", schema);
