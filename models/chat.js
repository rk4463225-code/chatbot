const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant", "system"], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

chatSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Chat", chatSchema);