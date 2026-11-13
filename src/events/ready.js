const { Events, ActivityType } = require('discord.js');
const databaseService = require('../services/databaseService');

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

    const protectedChannel = client.channels.cache.get(PROTECTED_CHANNEL_ID);
    if (protectedChannel?.isTextBased()) {
      try {
        const recentMessages = await protectedChannel.messages.fetch({ limit: 20 });
        const hasWarning = recentMessages.some(
          (message) =>
            message.author.id === client.user.id &&
            message.embeds[0]?.title === '🚫 PERINGATAN KEAMANAN'
        );

        if (!hasWarning) {
          await protectedChannel.send({
            embeds: [
              {
                color: 0xe74c3c,
                title: '🚫 PERINGATAN KEAMANAN',
                description:
                  'Channel ini **dilarang mengirim pesan**.\n\n' +
                  'Pesan dari user biasa akan dianggap sebagai indikasi akun bermasalah/hacked, ' +
                  'user akan langsung di-ban, dan pesan server akan dibersihkan.\n\n' +
                  'Jika terkena ban, silakan hubungi **Admin/Staff Athi Store** untuk proses unban manual.',
                footer: { text: 'Athi Store • Jangan mengirim pesan di channel ini' },
                timestamp: new Date().toISOString()
              }
            ]
          });
        }
      } catch (error) {
        console.error('❌ Gagal memasang warning channel keamanan:', error.message);
      }
    }
  }
};
