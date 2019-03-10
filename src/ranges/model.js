import mongoose from "mongoose";

const schema = new mongoose.Schema({
  start_time: {
    type: Date,
    required: true
  },
  end_time: {
    type: Date,
    required: true
  },
  start_id: {
    type: String,
    required: true
  },
  end_id: {
    type: String,
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

export default mongoose.model("range", schema);
