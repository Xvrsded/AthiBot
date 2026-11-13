const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const databaseService = require('../../services/databaseService');

/**
 * Command: /ping
 * Menampilkan latensi bot Discord dan koneksi database MongoDB.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Cek latensi respon bot dan status database MongoDB Athi Store'),

  async execute(interaction) {
    const embedColor = process.env.EMBED_COLOR || '#FF8474';

    await interaction.deferReply();
    const sent = await interaction.fetchReply();
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;
    const dbPing = await databaseService.getDbPing();

    const dbStatus = dbPing >= 0 ? `🟢 ${dbPing} ms` : '🔴 Terputus / Offline';

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🏓 Pong! Latensi Athibot')
      .setDescription('Status koneksi dan performa sistem **Athi Store** saat ini:')
      .addFields(
        { name: '⚡ Bot Latency', value: `\`${roundtrip} ms\``, inline: true },
        { name: '🌐 Discord WebSocket', value: `\`${wsPing} ms\``, inline: true },
        { name: '🍃 MongoDB Ping', value: `\`${dbStatus}\``, inline: true }
      )
      .setFooter({ text: 'Athi Store • Performa Optimal' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

