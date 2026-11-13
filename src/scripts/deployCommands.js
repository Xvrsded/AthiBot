require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Script Pendaftaran Slash Commands ke Discord API
 * Menelusuri seluruh command di src/commands/ dan mendaftarkannya ke Guild atau Global.
 */
async function deploy() {
  const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

  if (!TOKEN || !CLIENT_ID) {
    console.error('❌ [Deploy Error] TOKEN atau CLIENT_ID tidak ditemukan di .env!');
    process.exit(1);
  }

  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter((f) => f.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      try {
        const command = require(filePath);
        if ('data' in command && typeof command.data.toJSON === 'function') {
          commands.push(command.data.toJSON());
        }
      } catch (err) {
        console.error(`⚠️ Gagal membaca command di ${file}:`, err.message);
      }
    }
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log(`🚀 Memulai pendaftaran ${commands.length} slash commands ke Discord...`);

    try {
      if (GUILD_ID) {
        console.log(`📌 Mencoba mendaftarkan commands khusus Guild ID: ${GUILD_ID}...`);
        const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
          body: commands
        });
        console.log(`✅ Berhasil mendaftarkan ${data.length} slash commands ke server (Guild)!`);
        return;
      }
    } catch (guildErr) {
      console.warn(`⚠️ Pendaftaran khusus Guild gagal (${guildErr.message}). Beralih ke pendaftaran Global...`);
    }

    console.log('🌐 Mendaftarkan commands secara Global (seluruh server)...');
    const data = await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands
    });
    console.log(`✅ Berhasil mendaftarkan ${data.length} slash commands secara Global!`);
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat mendaftarkan command ke Discord:', error);
  }
}

deploy();

