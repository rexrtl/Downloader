import 'dotenv/config';
import { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { exec } from "child_process";
import fs from "fs";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let videoCache = {};
let queue = [];
let busy = false;

client.once("ready", () => {
  console.log("🚀 Downloader Bot Online");
});

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!dl")) return;

  const url = msg.content.split(" ")[1];
  if (!url) return msg.reply("❌ Send a video link");

  msg.reply("🔍 Getting available qualities...");

  exec(`yt-dlp -F "${url}"`, (err, stdout) => {
    if (err) return msg.reply("Failed to read formats.");

    const lines = stdout.split("\n").filter(l => l.match(/\d+p/));
    let formats = [];

    for (let line of lines) {
      const id = line.trim().split(/\s+/)[0];
      const res = line.match(/\d+p/)[0];
      const fps = line.includes("60") ? "60fps" : "30fps";

      formats.push({
        label: `${res} ${fps}`,
        value: id
      });
    }

    if (!formats.length) return msg.reply("No video formats found");

    videoCache[msg.author.id] = url;

    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_quality")
      .setPlaceholder("Select quality & FPS")
      .addOptions(formats.slice(0, 25));

    msg.channel.send({
      content: "🎥 Choose video quality:",
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  const format = interaction.values[0];
  const url = videoCache[interaction.user.id];

  queue.push({
    user: interaction.user,
    channel: interaction.channel,
    url,
    format
  });

  await interaction.reply("📥 Added to queue!");
  processQueue();
});

function processQueue() {
  if (busy || queue.length === 0) return;

  busy = true;
  const job = queue.shift();
  const filename = `video_${Date.now()}.mp4`;

  job.channel.send(`⬇ Downloading for **${job.user.username}**...`);

  exec(`yt-dlp -f ${job.format}+bestaudio --merge-output-format mp4 -o ${filename} "${job.url}"`, async () => {
    await job.channel.send({ files: [filename] });
    fs.unlinkSync(filename);
    busy = false;
    processQueue();
  });
}

client.login(process.env.TOKEN);
