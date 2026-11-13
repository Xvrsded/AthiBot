const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Command: /userinfo
 * Menampilkan informasi detail tentang profil pengguna Discord.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Menampilkan informasi detail tentang akun kamu atau pengguna lain')
    .addUserOption((option) =>
      option.setName('target').setDescription('Pilih pengguna yang ingin dilihat informasinya').setRequired(false)
    ),

  async execute(interaction) {
    const embedColor = process.env.EMBED_COLOR || '#FF8474';
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`👤 Informasi Pengguna: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🏷️ Tag / Username', value: `${targetUser.tag}`, inline: true },
        { name: '🆔 User ID', value: `\`${targetUser.id}\``, inline: true },
        { name: '🤖 Bot?', value: targetUser.bot ? 'Ya' : 'Bukan', inline: true },
        {
          name: '📅 Dibuat Pada',
          value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      );

    if (member) {
      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 15)
        .join(', ') || 'Tidak ada';

      embed.addFields(
        {
          name: '📥 Bergabung ke Server',
          value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Tidak diketahui',
          inline: true
        },
        {
          name: '⭐ Role Tertinggi',
          value: member.roles.highest ? `<@&${member.roles.highest.id}>` : '-',
          inline: true
        },
        {
          name: `🎭 Roles [${member.roles.cache.size - 1}]`,
          value: roles,
          inline: false
        }
      );
    }

    embed.setFooter({ text: 'Athi Store • User Profile' }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

