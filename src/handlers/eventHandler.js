const fs = require('fs');
const path = require('path');

/**
 * Handler Otomatis untuk Mendaftarkan Seluruh Event Discord
 * Membaca semua file event dalam folder src/events/
 * @param {import('discord.js').Client} client
 */
module.exports = (client) => {
  const eventsPath = path.join(__dirname, '..', 'events');

  if (!fs.existsSync(eventsPath)) {
    console.warn('⚠️ [EventHandler] Direktori events tidak ditemukan!');
    return;
  }

  const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));
  let totalEvents = 0;

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);

      if (!event.name || typeof event.execute !== 'function') {
        console.warn(`⚠️ [EventHandler] File ${file} tidak memiliki properti "name" atau "execute".`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => {
          Promise.resolve(event.execute(...args, client)).catch((err) => {
            console.error(`❌ Error pada event ${event.name}:`, err);
          });
        });
      } else {
        client.on(event.name, (...args) => {
          Promise.resolve(event.execute(...args, client)).catch((err) => {
            console.error(`❌ Error pada event ${event.name}:`, err);
          });
        });
      }

      totalEvents++;
    } catch (err) {
      console.error(`❌ [EventHandler] Gagal memuat event ${file}:`, err.message);
    }
  }

  console.log(`✅ [EventHandler] Berhasil mendaftarkan ${totalEvents} Discord client events.`);
};
