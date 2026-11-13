const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

/**
 * Command: /ticket-panel
 * Mengirimkan panel tiket interaktif ke channel yang ditentukan.
 * Akses: Administrator / ManageGuild
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Kirimkan panel tiket interaktif Athi Store ke suatu channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel tujuan pengiriman panel tiket (default: channel saat ini)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const embedColor = process.env.EMBED_COLOR || '#FF8474';

    const panelEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🍑 Athi Store - Pusat Bantuan & Layanan Tiket')
      .setDescription(
        'Selamat datang di sistem pelayanan resmi **Athi Store**!\n\n' +
        'Butuh bantuan, ingin konsultasi, atau memiliki kendala terkait pesanan kamu? ' +
        'Silakan klik salah satu tombol di bawah untuk membuat tiket privat dengan staff kami.\n\n' +
        '📌 **Kategori Tiket yang Tersedia:**\n' +
        '• 🛍️ **Order Robux** — Layanan transaksi & pembelian Robux\n' +
        '• 🛠️ **Bantuan & Tanya Jawab** — Pertanyaan umum & panduan\n' +
        '• ⚠️ **Lapor Kendala** — Masalah pesanan atau komplain layanan\n\n' +
        '*Harap bersabar setelah membuat tiket, staf kami akan segera melayani kamu dengan ramah.*'
      )
      .setImage(
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80'
      )
      .setFooter({
        text: 'Athi Store • Kepuasan Pelanggan Prioritas Kami',
        iconURL: interaction.guild.iconURL() || undefined
      })
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create_order')
        .setLabel('Order Robux')
        .setEmoji('🛍️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ticket_create_support')
        .setLabel('Bantuan / Support')
        .setEmoji('🛠️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_create_report')
        .setLabel('Lapor Kendala')
        .setEmoji('⚠️')
        .setStyle(ButtonStyle.Danger)
    );

    try {
      await targetChannel.send({ embeds: [panelEmbed], components: [buttons] });
      await interaction.reply({
        content: `✅ Panel tiket berhasil dikirim ke ${targetChannel}!`,
        ephemeral: true
      });
    } catch (err) {
      console.error('❌ Gagal mengirim panel tiket:', err);
      await interaction.reply({
        content: `❌ Gagal mengirim panel tiket: ${err.message}`,
        ephemeral: true
      });
    }
  }
};

