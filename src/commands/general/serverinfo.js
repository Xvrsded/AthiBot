const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

/**
 * Command: /serverinfo
 * Menampilkan informasi lengkap seputar server Discord tempat bot berada.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Menampilkan informasi detail tentang server ini'),

  async execute(interaction) {
    const { guild } = interaction;
    const embedColor = process.env.EMBED_COLOR || '#FF8474';

    const owner = await guild.fetchOwner();
    const channels = guild.channels.cache;
    const textChannels = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter((c) => c.type === ChannelType.GuildCategory).size;

    const totalMembers = guild.memberCount;
    const botCount = guild.members.cache.filter((m) => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`🏰 Informasi Server: ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👑 Pemilik Server', value: `${owner.user.tag} (<@${owner.id}>)`, inline: true },
        { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
        { name: '📅 Dibuat Pada', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        {
          name: '👥 Anggota',
          value: `Total: **${totalMembers}**\n👤 User: **${humanCount}** | 🤖 Bot: **${botCount}**`,
          inline: true
        },
        {
          name: '💬 Channels',
          value: `📝 Text: **${textChannels}**\n🔊 Voice: **${voiceChannels}**\n📁 Kategori: **${categories}**`,
          inline: true
        },
        {
          name: '🚀 Server Boost',
          value: `Level: **${guild.premiumTier}**\nTotal Boost: **${guild.premiumSubscriptionCount || 0}**`,
          inline: true
        },
        { name: '🎭 Jumlah Role', value: `\`${guild.roles.cache.size}\` roles`, inline: true }
      )
      .setFooter({ text: 'Athi Store • Server Information' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

