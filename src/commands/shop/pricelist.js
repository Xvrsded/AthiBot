const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const storeService = require('../../services/storeService');

/**
 * Command: /pricelist
 * Menampilkan katalog harga Robux Athi Store dengan menu dropdown kategori dan tombol order langsung.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('pricelist')
    .setDescription('Menampilkan katalog pricelist Robux resmi Athi Store')
    .addStringOption((option) =>
      option
        .setName('kategori')
        .setDescription('Pilih kategori yang ingin langsung dibuka')
        .setRequired(false)
        .addChoices(
          { name: '🍑 Robux Via Username', value: 'ROBUX VIA USERNAME' },
          { name: '🍑 Robux Vilog', value: 'ROBUX VILOG' }
        )
    ),

  async execute(interaction) {
    const embedColor = process.env.EMBED_COLOR || '#FF8474';
    const category = interaction.options.getString('kategori') || 'ROBUX VIA USERNAME';

    // Ambil data produk dari database jika ada, atau gunakan default
    const products = await storeService.getProducts(category);

    let desc = '';

    desc =
      `### 🍑 ${category === 'ROBUX VIA USERNAME' ? 'ROBUX VIA USERNAME' : 'PRICELIST ROBUX VILOG'}\n\n` +
      products.map((product) => `⏣ **${product.amount} Robux** ➜ ${storeService.formatRupiah(product.price)}`).join('\n') +
      '\n*(berlaku kelipatan)*\n\n' +
      (category === 'ROBUX VIA USERNAME'
        ? '📌 **Dibaca yaa:**\n' +
          '• Terima robux langsung masuk tersedia untuk akun yang sudah 18+ / sudah verifikasi identitas (KTP).\n' +
          '• Jangan lupa mengaktifkan verifikasi 2 langkah (Authenticator / 2SV).'
        : '⚡ **Keunggulan & Ketentuan:**\n' +
          '• Proses satset 1–15 menit langsung masuk!\n' +
          '• No limit, beli jumlah banyak pun boleh.');

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🍑 Athi Store - Pricelist Robux Terpercaya')
      .setDescription(desc)
      .setFooter({
        text: 'Athi Store • Garansi Legal & Terpercaya',
        iconURL: interaction.guild?.iconURL() || undefined
      })
      .setTimestamp();

    // Select Menu untuk berpindah kategori
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_pricelist_category')
      .setPlaceholder('Pilih kategori pricelist yang ingin dilihat...')
      .addOptions([
        {
          label: '🍑 Robux Via Username',
          description: 'Robux instan masuk via verifikasi akun',
          value: 'ROBUX VIA USERNAME',
          default: category === 'ROBUX VIA USERNAME'
        },
        {
          label: '🍑 Robux Vilog',
          description: 'Robux via login super cepat 1-15 menit',
          value: 'ROBUX VILOG',
          default: category === 'ROBUX VILOG'
        }
      ]);

    // Tombol Order
    const orderBtn = new ButtonBuilder()
      .setCustomId('shop_order_direct')
      .setLabel('🛍️ Order Sekarang')
      .setStyle(ButtonStyle.Success);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(orderBtn);

    await interaction.reply({ embeds: [embed], components: [row1, row2] });
  }
};
