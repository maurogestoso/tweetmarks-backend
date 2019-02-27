import mongoose from "mongoose";

const schema = new mongoose.Schema({
  screen_name: String,
  user_id: String,
  newest_id: { type: String, default: null },
  oldest_id: { type: String, default: null }
});

export default mongoose.model("user", schema);
