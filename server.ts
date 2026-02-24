import express from "express";
import { createServer as createViteServer } from "vite";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Discord Bot Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Gemini AI Setup
const getGenAI = () => {
  const keys = [
    process.env.USER_PROVIDED_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.API_KEY
  ];
  
  const key = keys
    .map(k => (k || "").trim())
    .find(k => k && k !== "MY_GEMINI_API_KEY" && k !== "YOUR_GEMINI_API_KEY");

  if (!key) {
    throw new Error("No valid Gemini API key found. Please check your secrets or environment variables.");
  }
  return new GoogleGenAI({ apiKey: key });
};

// OpenAI Setup
const getOpenAI = () => {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) {
    throw new Error("No OpenAI API key found. Please add OPENAI_API_KEY to your secrets.");
  }
  return new OpenAI({ apiKey: key });
};

// Bot Status and Logs
let botStatus = "Disconnected";
let botUser = null;
let isAutoReplyEnabled = true;
let preferredChatModel = "gemini"; // "gemini" or "chatgpt"
let recentLogs: { timestamp: string; level: string; message: string }[] = [];

function addLog(level: string, message: string) {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  console.log(`[${log.level}] ${log.message}`);
  recentLogs.unshift(log);
  if (recentLogs.length > 50) recentLogs.pop();
}

// Startup Diagnostics
const initialKey = (() => {
  const keys = [
    process.env.USER_PROVIDED_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.API_KEY
  ];
  return keys
    .map(k => (k || "").trim())
    .find(k => k && k !== "MY_GEMINI_API_KEY" && k !== "YOUR_GEMINI_API_KEY");
})();

if (!initialKey) {
  addLog("ERROR", "No valid Gemini API key found. AI features will fail until a key is provided.");
} else {
  addLog("INFO", `Gemini API Key detected (Length: ${initialKey.length}). Initializing AI...`);
}

async function registerCommands() {
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    addLog("WARN", "Discord credentials missing, skipping command registration.");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("chat")
      .setDescription("Chat with Gemini")
      .addStringOption(option =>
        option.setName("message")
          .setDescription("The message to send")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("chatgpt")
      .setDescription("Chat with ChatGPT (GPT-4o)")
      .addStringOption(option =>
        option.setName("message")
          .setDescription("The message to send")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Check the bot's latency"),
    new SlashCommandBuilder()
      .setName("auto-reply")
      .setDescription("Toggle auto-reply in the designated channel")
      .addBooleanOption(option =>
        option.setName("enabled")
          .setDescription("Whether auto-reply should be enabled")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("imagine")
      .setDescription("Generate a high-quality AI image (Gemini)")
      .addStringOption(option =>
        option.setName("prompt")
          .setDescription("The image description")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("aspect_ratio")
          .setDescription("The aspect ratio of the image (Default: 1:1)")
          .addChoices(
            { name: "1:1 (Square)", value: "1:1" },
            { name: "16:9 (Landscape)", value: "16:9" },
            { name: "9:16 (Portrait)", value: "9:16" },
            { name: "4:3", value: "4:3" },
            { name: "3:4", value: "3:4" }
          )
      ),
    new SlashCommandBuilder()
      .setName("dalle")
      .setDescription("Generate an image using OpenAI DALL-E 3")
      .addStringOption(option =>
        option.setName("prompt")
          .setDescription("The image description")
          .setRequired(true)
      ),
  ].map(command => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    addLog("INFO", "Started refreshing application (/) commands.");
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    addLog("INFO", "Successfully reloaded application (/) commands.");
  } catch (error: any) {
    addLog("ERROR", `Failed to register commands: ${error.message}`);
  }
}

client.on("ready", () => {
  addLog("INFO", `Logged in as ${client.user?.tag}!`);
  botStatus = "Online";
  botUser = {
    username: client.user?.username,
    tag: client.user?.tag,
    avatar: client.user?.displayAvatarURL(),
  };
});

client.on("messageCreate", async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  const isMentioned = client.user && message.mentions.has(client.user);
  const isAutoReplyChannel = process.env.DISCORD_AUTO_REPLY_CHANNEL_ID === message.channel.id;
  
  // Only proceed if mentioned OR (in the auto-reply channel AND auto-reply is enabled)
  if (!isMentioned && !(isAutoReplyChannel && isAutoReplyEnabled)) {
    // Log that we saw a message but are ignoring it
    if (message.content.length > 0) {
      addLog("DEBUG", `Ignored message from ${message.author.tag} (Not mentioned and auto-reply disabled/wrong channel)`);
    }
    return;
  }

  // Start typing indicator
  try {
    await message.channel.sendTyping();
  } catch (e) {
    addLog("WARN", "Failed to send typing indicator (missing permissions?)");
  }

  // Clean the prompt by removing the bot mention if it exists
  let prompt = message.content;
  if (client.user) {
    prompt = prompt.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  }

  if (!prompt && isMentioned) {
    await message.reply("Hello! How can I help you today? You can ask me questions or use `/imagine` to generate images.");
    return;
  }

  if (!prompt) return; // Don't reply to empty messages in auto-reply channel

  try {
    addLog("INFO", `Processing message from ${message.author.tag}: ${prompt.substring(0, 50)}...`);
    const ai = getGenAI();
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
    });
    const response = result.text;

    if (response && response.length > 2000) {
      await message.reply(response.substring(0, 1997) + "...");
    } else if (response) {
      await message.reply(response);
    } else {
      addLog("WARN", "Gemini returned empty text response.");
      await message.reply("I'm sorry, I couldn't generate a response.");
    }
  } catch (error: any) {
    const errorDetail = error.message || "Unknown error";
    addLog("ERROR", `Error in message handler: ${errorDetail}`);
    
    let userMessage = "Sorry, I encountered an error while thinking about that.";
    if (errorDetail.includes("API key")) {
      userMessage = "The bot's AI configuration is invalid. Please contact the administrator.";
      addLog("WARN", "Gemini API reported an issue with the API key. Check your GEMINI_API_KEY secret.");
    }
    if (errorDetail.includes("safety")) {
      userMessage = "I cannot fulfill this request due to safety guidelines.";
    }
    await message.reply(userMessage);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply(`🏓 Pong! Latency is ${Math.round(client.ws.ping)}ms.`);
  }

  if (interaction.commandName === "chat") {
    await interaction.deferReply();
    const message = interaction.options.getString("message");
    
    try {
      addLog("INFO", `Processing /chat (${preferredChatModel}) from ${interaction.user.tag}`);
      
      let response = "";
      if (preferredChatModel === "chatgpt") {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: message || "" }],
          model: "gpt-4o",
        });
        response = completion.choices[0].message.content || "";
      } else {
        const ai = getGenAI();
        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: message || "",
          config: { 
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            tools: [{ googleSearch: {} }]
          }
        });
        response = result.text || "";
      }
      
      // Discord has a 2000 character limit
      if (response && response.length > 2000) {
        await interaction.editReply(response.substring(0, 1997) + "...");
      } else if (response) {
        await interaction.editReply(response);
      } else {
        addLog("WARN", `${preferredChatModel} returned empty text response for /chat.`);
        await interaction.editReply("The model returned an empty response.");
      }
    } catch (error: any) {
      addLog("ERROR", `Error in /chat handler (${preferredChatModel}): ${error.message}`);
      await interaction.editReply(`Sorry, I encountered an error: ${error.message || "Unknown error"}`);
    }
  }

  if (interaction.commandName === "chatgpt") {
    await interaction.deferReply();
    const message = interaction.options.getString("message");
    
    try {
      addLog("INFO", `Processing /chatgpt from ${interaction.user.tag}`);
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: message || "" }],
        model: "gpt-4o",
      });
      
      const response = completion.choices[0].message.content;
      
      if (response && response.length > 2000) {
        await interaction.editReply(response.substring(0, 1997) + "...");
      } else if (response) {
        await interaction.editReply(response);
      } else {
        addLog("WARN", "OpenAI returned empty response for /chatgpt.");
        await interaction.editReply("The model returned an empty response.");
      }
    } catch (error: any) {
      addLog("ERROR", `Error in /chatgpt handler: ${error.message}`);
      await interaction.editReply(`Sorry, I encountered an error: ${error.message || "Unknown error"}`);
    }
  }

  if (interaction.commandName === "auto-reply") {
    const enabled = interaction.options.getBoolean("enabled") ?? true;
    isAutoReplyEnabled = enabled;
    addLog("INFO", `Auto-reply toggled to: ${enabled} by ${interaction.user.tag}`);
    await interaction.reply(`Auto-reply has been **${enabled ? "enabled" : "disabled"}**.`);
  }

  if (interaction.commandName === "imagine") {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");
    const aspectRatio = interaction.options.getString("aspect_ratio") || "1:1";

    try {
      addLog("INFO", `Processing /imagine from ${interaction.user.tag}: ${prompt?.substring(0, 50)}...`);
      const ai = getGenAI();
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts: [{ text: prompt || "" }] }],
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
          }
        }
      });
      
      let imagePart = null;
      if (result.candidates && result.candidates[0].content.parts) {
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData) {
            imagePart = part.inlineData;
            break;
          }
        }
      }

      if (imagePart) {
        const buffer = Buffer.from(imagePart.data, "base64");
        const attachment = new AttachmentBuilder(buffer, { name: "generated-image.png" });
        await interaction.editReply({ 
          content: `**Gemini Image**\n**Prompt:** ${prompt}\n**Aspect Ratio:** ${aspectRatio}`, 
          files: [attachment] 
        });
        addLog("INFO", "Successfully generated and sent Gemini image.");
      } else {
        addLog("WARN", "No image data returned from Gemini.");
        await interaction.editReply("I couldn't generate an image for that prompt.");
      }
    } catch (error: any) {
      addLog("ERROR", `Error in /imagine handler: ${error.message}`);
      let userMessage = `Sorry, I encountered an error while generating the image: ${error.message || "Unknown error"}`;
      if (error.message?.includes("safety")) userMessage = "I cannot generate that image due to safety guidelines.";
      await interaction.editReply(userMessage);
    }
  }

  if (interaction.commandName === "dalle") {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");

    try {
      addLog("INFO", `Processing /dalle from ${interaction.user.tag}: ${prompt?.substring(0, 50)}...`);
      const openai = getOpenAI();
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt || "",
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response.data[0].url;
      if (imageUrl) {
        await interaction.editReply({ 
          content: `**DALL-E 3 Image**\n**Prompt:** ${prompt}`, 
          embeds: [{ image: { url: imageUrl } }]
        });
        addLog("INFO", "Successfully generated and sent DALL-E image.");
      } else {
        addLog("WARN", "No image URL returned from OpenAI.");
        await interaction.editReply("I couldn't generate an image for that prompt.");
      }
    } catch (error: any) {
      addLog("ERROR", `Error in /dalle handler: ${error.message}`);
      await interaction.editReply(`Sorry, I encountered an error: ${error.message || "Unknown error"}`);
    }
  }
});

// API Routes
app.get("/api/test-ai", async (req, res) => {
  try {
    const ai = getGenAI();
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hello, are you working?",
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
    });
    res.json({ success: true, response: result.text });
  } catch (error: any) {
    console.error("AI Test Error:", error);
    res.json({ success: false, error: error.message || "Unknown error" });
  }
});

app.get("/api/status", (req, res) => {
  const mask = (str: string | undefined) => {
    if (!str) return "Missing";
    if (str.length <= 8) return "****";
    return str.substring(0, 4) + "...." + str.substring(str.length - 4);
  };

  const inviteLink = process.env.DISCORD_CLIENT_ID 
    ? `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=137442470400&scope=bot%20applications.commands`
    : null;

  const currentApiKey = (() => {
    const keys = [
      process.env.USER_PROVIDED_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY,
      process.env.API_KEY
    ];
    return keys
      .map(k => (k || "").trim())
      .find(k => k && k !== "MY_GEMINI_API_KEY" && k !== "YOUR_GEMINI_API_KEY");
  })();

  res.json({
    status: botStatus,
    user: botUser,
    inviteLink,
    isAutoReplyEnabled,
    preferredChatModel,
    config: {
      discordToken: mask(process.env.DISCORD_TOKEN),
      discordClientId: mask(process.env.DISCORD_CLIENT_ID),
      geminiApiKey: mask(currentApiKey),
      openaiApiKey: mask(process.env.OPENAI_API_KEY),
      autoReplyChannel: process.env.DISCORD_AUTO_REPLY_CHANNEL_ID || "Not Set"
    },
    configMissing: !process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID,
    geminiMissing: !currentApiKey,
    openaiMissing: !process.env.OPENAI_API_KEY,
    logs: recentLogs,
  });
});

app.post("/api/settings", (req, res) => {
  const { preferredChatModel: newModel } = req.body;
  if (newModel === "gemini" || newModel === "chatgpt") {
    preferredChatModel = newModel;
    addLog("INFO", `Preferred chat model updated to: ${newModel}`);
    res.json({ success: true, preferredChatModel });
  } else {
    res.status(400).json({ success: false, error: "Invalid model selection" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(err => {
      console.error("Failed to login to Discord:", err);
      botStatus = "Error (Login Failed)";
    });
    registerCommands();
  } else {
    botStatus = "Configuration Required";
  }
}

startServer();
