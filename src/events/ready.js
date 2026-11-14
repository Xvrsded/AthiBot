const { Events, ActivityType } = require('discord.js');
const databaseService = require('../services/databaseService');
const storeDashboardService = require('../services/storeDashboardService');

const PROTECTED_CHANNEL_ID = '1570116755261759600';

/**
 * Event: Ready
 * Dieksekusi sekali ketika bot berhasil login dan siap melayani interaksi.
 */
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log('====================================================');
    console.log(`🤖 Athibot Online sebagai: ${client.user.tag}`);
    console.log(`🆔 Client ID: ${client.user.id}`);
    console.log(`🌐 Server Terhubung: ${client.guilds.cache.size} server`);
    client.guilds.cache.forEach((g) => {
      console.log(`🏰 Server: "${g.name}" | ID: ${g.id}`);
    });
    console.log('====================================================');

    // Set Status Presence Bot
    client.user.setPresence({
      activities: [
        {
          name: 'Athi Store 🍑 | /pricelist',
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    });

    // Inisialisasi koneksi MongoDB jika belum
    await databaseService.connect();

    for (const guild of client.guilds.cache.values()) {
      try {
        await storeDashboardService.updateDashboard(guild);
      } catch (error) {
        console.error(`❌ Gagal memperbarui dashboard toko di ${guild.name}:`, error.message);
      }
    }

    const protectedChannel = client.channels.cache.get(PROTECTED_CHANNEL_ID);
    if (protectedChannel?.isTextBased()) {
      try {
        const recentMessages = await protectedChannel.messages.fetch({ limit: 20 });
        const warningMessage = recentMessages.find(
          (message) =>
            message.author.id === client.user.id &&
            message.embeds[0]?.title === '⚠️ CHANNEL LAPOR AKUN TER-HACK'
        );

        const warningPayload = {
          embeds: [
            {
              color: 0xe74c3c,
              title: '⚠️ CHANNEL LAPOR AKUN TER-HACK',
              description:
                'Channel ini adalah pengecualian rules dan dapat digunakan untuk mengirim pesan laporan akun yang ter-hack.\n\n' +
                '⚠️ Pesan dari member biasa akan memicu prosedur keamanan otomatis dan akun pengirim dapat langsung di-ban. ' +
                'Jika terkena ban, silakan hubungi Admin/Staff Athi Store untuk proses unban manual.',
              footer: { text: 'Athi Store • Gunakan channel ini hanya untuk laporan keamanan' },
              timestamp: new Date().toISOString()
            }
          ]
        };

        if (warningMessage) {
          await warningMessage.edit(warningPayload);
        } else {
          await protectedChannel.send(warningPayload);
        }
      } catch (error) {
        console.error('❌ Gagal memasang warning channel keamanan:', error.message);
      }
    }
  }
};
