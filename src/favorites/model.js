import mongoose from "mongoose";

const schema = new mongoose.Schema({
  id_str: String,
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  created_at: Date,
  processed: {
    type: Boolean,
    default: false
  }
});

export default mongoose.model("favorite", schema);
