const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

/**
 * Handler Otomatis untuk Memuat Semua Slash Commands
 * Menelusuri seluruh subfolder dalam src/commands/ (admin, general, shop)
 * @param {import('discord.js').Client} client
 */
module.exports = (client) => {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');

  if (!fs.existsSync(commandsPath)) {
    console.warn('⚠️ [CommandHandler] Direktori commands tidak ditemukan!');
    return;
  }

  const commandFolders = fs.readdirSync(commandsPath);
  let totalCommands = 0;

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      try {
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          totalCommands++;
        } else {
          console.warn(`⚠️ [CommandHandler] File ${filePath} tidak memiliki properti "data" atau "execute" yang valid.`);
        }
      } catch (err) {
        console.error(`❌ [CommandHandler] Gagal memuat command ${file}:`, err.message);
      }
    }
  }

  console.log(`✅ [CommandHandler] Berhasil memuat ${totalCommands} slash commands ke dalam memory.`);
};

