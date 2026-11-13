require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');

/**
 * Entry Point Utama Athibot (Athi Store)
 * Menginisialisasi Discord Client, intents, handlers, dan login.
 */

// Validasi Token Discord
if (!process.env.TOKEN) {
  console.error('❌ [FATAL] Environment variable "TOKEN" belum diset di file .env!');
  console.error('Silakan buat file .env dari .env.example dan isi TOKEN bot Discord kamu.');
  process.exit(1);
}

// Inisialisasi Discord Client dengan Intents yang Diperlukan
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember
  ]
});

// Load Command Handler & Event Handler
commandHandler(client);
eventHandler(client);

// Penanganan Unhandled Rejection & Uncaught Exception agar Bot Tetap Stabil
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [AntiCrash] Unhandled Rejection pada:', promise, 'alasan:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('⚠️ [AntiCrash] Uncaught Exception:', err, 'asal:', origin);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
  console.error('⚠️ [AntiCrash] Uncaught Exception Monitor:', err, 'asal:', origin);
});

// Login ke Discord Gateway
client.login(process.env.TOKEN).catch((err) => {
  console.error('❌ [Login Error] Gagal login ke Discord. Pastikan TOKEN di .env valid!', err.message);
});

