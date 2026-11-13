const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const storeService = require('../../services/storeService');

/**
 * Command: /order
 * Memulai proses pemesanan Robux Athi Store melalui dropdown dan formulir modal interaktif.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('order')
    .setDescription('Pesan paket Robux di Athi Store dengan mudah dan cepat')
    .addStringOption((option) =>
      option
        .setName('kategori')
        .setDescription('Filter kategori paket Robux')
        .setRequired(false)
        .addChoices(
          { name: '🍑 Robux Via Username', value: 'ROBUX VIA USERNAME' },
          { name: '🍑 Robux Vilog', value: 'ROBUX VILOG' }
        )
    ),

  async execute(interaction) {
    const embedColor = process.env.EMBED_COLOR || '#FF8474';
    const category = interaction.options.getString('kategori') || null;

    const products = await storeService.getProducts(category);

    if (!products.length) {
      return interaction.reply({
        content: '⚠️ Belum ada produk aktif yang tersedia di katalog saat ini.',
        ephemeral: true
      });
    }

    const options = products.slice(0, 25).map((p) => ({
      label: `${p.name} - ${storeService.formatRupiah(p.price)}`,
      description: `${p.category} | ${p.description || 'Proses kilat'}`,
      value: p._id.toString()
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_order_product')
      .setPlaceholder('Pilih paket Robux yang ingin kamu beli...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🛍️ Formulir Pemesanan Robux - Athi Store')
      .setDescription(
        'Silakan pilih paket Robux yang ingin kamu pesan pada menu dropdown di bawah ini.\n' +
        'Setelah memilih, formulir input data (Username Roblox & Jumlah) akan muncul otomatis.'
      )
      .setFooter({ text: 'Athi Store • Layanan Cepat & Terpercaya' });

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};

