const { Events, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

const MEMBER_ROLE_ID = '1570726972362068009';
const BOT_ROLE_ID = '1571067541781221446';

/**
 * Event: GuildMemberAdd
 * Dipanggil ketika ada member baru yang bergabung ke server.
 * Mengirimkan pesan selamat datang sesuai konfigurasi server.
 */
module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      const roleId = member.user.bot ? BOT_ROLE_ID : MEMBER_ROLE_ID;
      const role = member.guild.roles.cache.get(roleId);

      if (!role) {
        console.error(`❌ Role ${roleId} tidak ditemukan di server ${member.guild.id}.`);
      } else {
        await member.roles.add(role, 'Assign role otomatis saat member bergabung');
      }

      const config = await GuildConfig.findOne({ guildId: member.guild.id });
      if (!config || !config.welcomeEnabled || !config.welcomeChannelId) return;

      const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
      if (!welcomeChannel) return;

      const embedColor = config.embedColor || process.env.EMBED_COLOR || '#FF8474';

      let messageText = config.welcomeMessage || 'Selamat datang {user} di **{server}**! 🎉';
      messageText = messageText
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount.toString());

      const welcomeEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`👋 Selamat Datang di ${member.guild.name}!`)
        .setDescription(messageText)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: `Member #${member.guild.memberCount} • Athi Store Official` })
        .setTimestamp();

      await welcomeChannel.send({ embeds: [welcomeEmbed] }).catch(() => {});
    } catch (err) {
      console.error('❌ Error pada event guildMemberAdd:', err.message);
    }
  }
};

