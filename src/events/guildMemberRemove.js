const { Events, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

/**
 * Event: GuildMemberRemove
 * Dipanggil ketika ada member yang keluar / di-kick dari server.
 * Mengirimkan pesan perpisahan sesuai konfigurasi server.
 */
module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      const config = await GuildConfig.findOne({ guildId: member.guild.id });
      if (!config || !config.goodbyeEnabled || !config.goodbyeChannelId) return;

      const goodbyeChannel = member.guild.channels.cache.get(config.goodbyeChannelId);
      if (!goodbyeChannel) return;

      const embedColor = '#95A5A6';

      let messageText = config.goodbyeMessage || 'Sampai jumpa {username}! Terima kasih telah mampir di **{server}** 👋';
      messageText = messageText
        .replace(/{user}/g, member.user.username)
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount.toString());

      const goodbyeEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`👋 Sampai Jumpa!`)
        .setDescription(messageText)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: `Tersisa ${member.guild.memberCount} member • Athi Store` })
        .setTimestamp();

      await goodbyeChannel.send({ embeds: [goodbyeEmbed] }).catch(() => {});
    } catch (err) {
      console.error('❌ Error pada event guildMemberRemove:', err.message);
    }
  }
};

