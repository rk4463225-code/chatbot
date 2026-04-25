const axios = require("axios");

function calculate(expression) {
  try {
    if (/[^0-9+\-*/().\s]/.test(expression)) return "Invalid characters.";
    const result = eval(expression);
    return `Result = ${result}`;
  } catch {
    return "Could not calculate.";
  }
}

async function getWeather(city) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return "Weather API key missing.";
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const response = await axios.get(url);
    const data = response.data;
    return `🌡️ ${city}: ${data.weather[0].description}, ${data.main.temp}°C, humidity ${data.main.humidity}%.`;
  } catch {
    return `Could not fetch weather for "${city}".`;
  }
}

function getCurrentTime() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

module.exports = { calculate, getWeather, getCurrentTime };