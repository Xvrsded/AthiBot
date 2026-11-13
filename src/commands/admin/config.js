const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const GuildConfig = require('../../models/GuildConfig');

/**
 * Command: /config
 * Mengatur seluruh konfigurasi server (Welcome, Goodbye, Ticket, Order, Role Staff, dll).
 * Akses: Administrator / ManageGuild
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Konfigurasi pengaturan server Athibot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // Subcommand: View
    .addSubcommand((sub) => sub.setName('view').setDescription('Lihat konfigurasi bot yang aktif di server ini'))
    // Subcommand: Welcome
    .addSubcommand((sub) =>
      sub
        .setName('welcome')
        .setDescription('Atur channel dan pesan selamat datang (Welcome)')
        .addBooleanOption((opt) => opt.setName('aktif').setDescription('Aktifkan pesan welcome?').setRequired(true))
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel tempat pesan welcome dikirim')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('pesan')
            .setDescription('Template pesan (gunakan {user}, {username}, {server}, {memberCount})')
            .setRequired(false)
        )
    )
    // Subcommand: Goodbye
    .addSubcommand((sub) =>
      sub
        .setName('goodbye')
        .setDescription('Atur channel dan pesan perpisahan (Goodbye)')
        .addBooleanOption((opt) => opt.setName('aktif').setDescription('Aktifkan pesan goodbye?').setRequired(true))
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel tempat pesan goodbye dikirim')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('pesan')
            .setDescription('Template pesan perpisahan')
            .setRequired(false)
        )
    )
    // Subcommand: Ticket
    .addSubcommand((sub) =>
      sub
        .setName('ticket')
        .setDescription('Atur channel log transkrip tiket')
        .addChannelOption((opt) =>
          opt
            .setName('log_channel')
            .setDescription('Channel log transkrip tiket ditutup')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    // Subcommand: Order
    .addSubcommand((sub) =>
      sub
        .setName('order')
        .setDescription('Atur channel notifikasi pesanan masuk untuk staff')
        .addChannelOption((opt) =>
          opt
            .setName('log_channel')
            .setDescription('Channel notifikasi pesanan baru')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    // Subcommand: Staff Role
    .addSubcommand((sub) =>
      sub
        .setName('staff-role')
        .setDescription('Tentukan role staff pengelola tiket & order')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role staff/admin Athi Store').setRequired(true)
        )
    )
    // Subcommand: Embed Color
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Ubah warna embed utama bot (HEX)')
        .addStringOption((opt) =>
          opt.setName('hex').setDescription('Kode HEX warna (contoh: #FF8474)').setRequired(true)
        )
    ),

  async execute(interaction) {
    const { guild } = interaction;
    const subcommand = interaction.options.getSubcommand();

    // Dapatkan atau buat config baru
    let config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config) {
      config = new GuildConfig({ guildId: guild.id });
    }

    const embedColor = config.embedColor || process.env.EMBED_COLOR || '#FF8474';

    // 1. VIEW CONFIG
    if (subcommand === 'view') {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`⚙️ Pengaturan Athibot - ${guild.name}`)
        .addFields(
          {
            name: '👋 Welcome Member',
            value: `Status: **${config.welcomeEnabled ? '🟢 Aktif' : '🔴 Nonaktif'}**\nChannel: ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '*Belum diset*'}\nPesan: \`${config.welcomeMessage || 'Default'}\``
          },
          {
            name: '👋 Goodbye Member',
            value: `Status: **${config.goodbyeEnabled ? '🟢 Aktif' : '🔴 Nonaktif'}**\nChannel: ${config.goodbyeChannelId ? `<#${config.goodbyeChannelId}>` : '*Belum diset*'}\nPesan: \`${config.goodbyeMessage || 'Default'}\``
          },
          {
            name: '🎫 Sistem Tiket',
            value: `Kategori tetap: <#1570431160222228541>\nLog Channel: ${config.ticketLogChannelId ? `<#${config.ticketLogChannelId}>` : '*Sesuai .env*'}`
          },
          {
            name: '🛒 Sistem Order',
            value: `Channel Notifikasi: ${config.orderLogChannelId ? `<#${config.orderLogChannelId}>` : '*Sesuai .env*'}`
          },
          {
            name: '👮 Role Staff',
            value: config.staffRoleId ? `<@&${config.staffRoleId}>` : '*Sesuai .env / Admin Only*'
          },
          {
            name: '🎨 Warna Embed',
            value: `\`${config.embedColor}\``
          }
        )
        .setFooter({ text: 'Athi Store • Server Configuration' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 2. WELCOME CONFIG
    if (subcommand === 'welcome') {
      const aktif = interaction.options.getBoolean('aktif');
      const channel = interaction.options.getChannel('channel');
      const pesan = interaction.options.getString('pesan');

      config.welcomeEnabled = aktif;
      if (channel) config.welcomeChannelId = channel.id;
      if (pesan) config.welcomeMessage = pesan;

      await config.save();
      return interaction.reply({
        content: `✅ Pengaturan Welcome berhasil disimpan!\n• Status: **${aktif ? 'Aktif' : 'Nonaktif'}**\n• Channel: ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '*Belum diset*'}`,
        ephemeral: true
      });
    }

    // 3. GOODBYE CONFIG
    if (subcommand === 'goodbye') {
      const aktif = interaction.options.getBoolean('aktif');
      const channel = interaction.options.getChannel('channel');
      const pesan = interaction.options.getString('pesan');

      config.goodbyeEnabled = aktif;
      if (channel) config.goodbyeChannelId = channel.id;
      if (pesan) config.goodbyeMessage = pesan;

      await config.save();
      return interaction.reply({
        content: `✅ Pengaturan Goodbye berhasil disimpan!\n• Status: **${aktif ? 'Aktif' : 'Nonaktif'}**\n• Channel: ${config.goodbyeChannelId ? `<#${config.goodbyeChannelId}>` : '*Belum diset*'}`,
        ephemeral: true
      });
    }

    // 4. TICKET CONFIG
    if (subcommand === 'ticket') {
      const logChannel = interaction.options.getChannel('log_channel');

      if (logChannel) config.ticketLogChannelId = logChannel.id;

      await config.save();
      return interaction.reply({
        content: `✅ Pengaturan Tiket berhasil disimpan!\n• Kategori tetap: <#1570431160222228541>\n• Log Channel: ${config.ticketLogChannelId ? `<#${config.ticketLogChannelId}>` : 'Default'}`,
        ephemeral: true
      });
    }

    // 5. ORDER CONFIG
    if (subcommand === 'order') {
      const logChannel = interaction.options.getChannel('log_channel');
      config.orderLogChannelId = logChannel.id;
      await config.save();

      return interaction.reply({
        content: `✅ Channel notifikasi order berhasil diatur ke <#${logChannel.id}>!`,
        ephemeral: true
      });
    }

    // 6. STAFF ROLE CONFIG
    if (subcommand === 'staff-role') {
      const role = interaction.options.getRole('role');
      config.staffRoleId = role.id;
      await config.save();

      return interaction.reply({
        content: `✅ Role staff berhasil diatur ke <@&${role.id}>!`,
        ephemeral: true
      });
    }

    // 7. EMBED COLOR CONFIG
    if (subcommand === 'color') {
      const hex = interaction.options.getString('hex');
      if (!/^#([0-9A-F]{3}){1,2}$/i.test(hex)) {
        return interaction.reply({
          content: '❌ Format HEX tidak valid! Contoh format yang benar: `#FF8474`',
          ephemeral: true
        });
      }

      config.embedColor = hex;
      await config.save();

      return interaction.reply({
        content: `✅ Warna embed berhasil diubah ke \`${hex}\`!`,
        ephemeral: true
      });
    }
  }
};
