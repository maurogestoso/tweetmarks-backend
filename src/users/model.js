import mongoose from "mongoose";

const schema = new mongoose.Schema({
  screen_name: String,
  user_id: String,
  top_range: {
    newest_id: {
      type: String,
      default: null
    },
    oldest_id: {
      type: String,
      default: null
    }
  },
  bottom_range: {
    newest_id: {
      type: String,
      default: null
    },
    oldest_id: {
      type: String,
      default: null
    }
  }
});

schema.methods.hasBottomRange = function() {
  return this.bottom_range.newest_id && this.bottom_range.oldest_id;
};

schema.methods.hasTopRange = function() {
  return this.top_range.newest_id && this.top_range.oldest_id;
};

export default mongoose.model("user", schema);
