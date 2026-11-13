const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Command: /help
 * Menampilkan daftar seluruh slash command yang tersedia di Athibot.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Menampilkan panduan dan daftar perintah Athibot (Athi Store)'),

  async execute(interaction) {
    const embedColor = process.env.EMBED_COLOR || '#FF8474';

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🍑 Athibot - Pusat Bantuan & Panduan')
      .setDescription(
        'Selamat datang di **Athibot**, asisten resmi **Athi Store**!\n' +
        'Berikut adalah daftar perintah yang dapat kamu gunakan di server ini:\n'
      )
      .addFields(
        {
          name: '🛒 Toko & Pembelian',
          value:
            '• `/pricelist` - Lihat katalog harga paket Robux via Username & Vilog.\n' +
            '• `/order` - Formulir pemesanan langsung paket Robux.'
        },
        {
          name: 'ℹ️ Utilitas & Server',
          value:
            '• `/help` - Menampilkan menu bantuan ini.\n' +
            '• `/ping` - Cek latensi bot dan status database MongoDB.\n' +
            '• `/serverinfo` - Melihat detail lengkap tentang server Discord ini.\n' +
            '• `/userinfo` - Melihat informasi akun pengguna atau member lain.'
        },
        {
          name: '👑 Administrasi & Staff (Admin Only)',
          value:
            '• `/ticket-panel` - Mengirim panel tiket interaktif ke channel.\n' +
            '• `/order-manage` - Kelola dan lihat daftar pesanan pelanggan.\n' +
            '• `/product` - Tambah, edit, hapus, dan lihat daftar produk di database.\n' +
            '• `/config` - Konfigurasi channel log, role staff, tiket, dan pesan welcome.'
        }
      )
      .setFooter({
        text: 'Athi Store • Layanan Robux Murah & Terpercaya',
        iconURL: interaction.guild?.iconURL() || undefined
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

