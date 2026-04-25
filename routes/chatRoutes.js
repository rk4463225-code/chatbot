const express = require("express");
const router = express.Router();
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const Chat = require("../models/chat");
const { calculate, getWeather, getCurrentTime } = require("../utils/tools");

// Rate limiter
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.body.userId || req.ip,
  handler: (req, res) => {
    res.status(429).json({ error: "Too many requests. Please slow down." });
  }
});

// Helper: call Groq without tools (for final answer)
async function callGroqSimple(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY missing in .env");
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: 30000,
    }
  );
  return response.data.choices[0].message.content;
}

// Helper: call Groq that may return tool calls
async function callGroqWithTools(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY missing in .env");
  const tools = [
    {
      type: "function",
      function: {
        name: "calculate",
        description: "Perform a math calculation",
        parameters: {
          type: "object",
          properties: { expression: { type: "string" } },
          required: ["expression"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getWeather",
        description: "Get weather for a city",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getCurrentTime",
        description: "Get current time in India",
      },
    },
  ];
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.7,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: 30000,
    }
  );
  return response.data.choices[0].message;
}

// Main endpoint
router.post("/send", chatLimiter, async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message required" });
    }

    // Get or create chat
    let chat = await Chat.findOne({ userId });
    if (!chat) chat = new Chat({ userId, messages: [] });
    chat.messages.push({ role: "user", content: message });

    // Build conversation history with system prompt
    const systemPrompt = {
      role: "system",
      content: `You are Sakhi, an AI assistant. You have access to tools: calculate (for math), getWeather (for weather), getCurrentTime (for time). When a user asks something that needs a tool, respond by ONLY calling the appropriate tool. Do NOT explain or write extra text before calling the tool. After getting the result, you will produce a natural answer.`,
    };
    const historyForLLM = [systemPrompt];
    const lastMsgs = chat.messages.slice(-15);
    for (const msg of lastMsgs) {
      historyForLLM.push({ role: msg.role, content: msg.content });
    }

    // First call: may get tool calls
    let assistantMsg = await callGroqWithTools(historyForLLM);
    let finalReply = "";

    // Check if there are tool calls
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      const toolResults = [];
      for (const toolCall of assistantMsg.tool_calls) {
        const toolName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result = "";
        if (toolName === "calculate") result = calculate(args.expression);
        else if (toolName === "getWeather") result = await getWeather(args.city);
        else if (toolName === "getCurrentTime") result = getCurrentTime();
        else result = "Tool not recognized.";
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      // Second call: feed tool results back and ask for final answer
      const finalMessages = [...historyForLLM, assistantMsg, ...toolResults];
      // Use simple call (no tools) to get natural answer
      finalReply = await callGroqSimple(finalMessages);
    } else {
      // No tool calls, just use the content
      finalReply = assistantMsg.content;
    }

    // Save assistant reply
    chat.messages.push({ role: "assistant", content: finalReply });
    await chat.save();

    res.json({ reply: finalReply });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "AI service error. Check GROQ_API_KEY." });
  }
});

// History endpoints
router.get("/history/:userId", async (req, res) => {
  const chat = await Chat.findOne({ userId: req.params.userId });
  res.json(chat ? chat.messages : []);
});
router.delete("/history/:userId", async (req, res) => {
  await Chat.findOneAndDelete({ userId: req.params.userId });
  res.json({ success: true });
});
router.get("/", (req, res) => res.json({ status: "Chat route active" }));

module.exports = router;