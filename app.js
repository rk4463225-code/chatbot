require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));   // ✅ index.html को serve करेगा

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/aiChat")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => { console.error("❌ DB Error:", err.message); process.exit(1); });

app.use("/chat", chatRoutes);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  server.close(() => mongoose.connection.close(false, () => process.exit(0)));
});



