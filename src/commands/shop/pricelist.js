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

    if (category === 'ROBUX VIA USERNAME') {
      desc =
        '### 🍑 ROBUX VIA USERNAME\n\n' +
        '⏣ **25r**   ➜ Rp 5.000\n' +
        '⏣ **50r**   ➜ Rp 9.000\n' +
        '⏣ **100r**  ➜ Rp 15.600\n' +
        '⏣ **200r**  ➜ Rp 31.200\n' +
        '⏣ **300r**  ➜ Rp 46.800\n' +
        '⏣ **400r**  ➜ Rp 62.400\n' +
        '⏣ **500r**  ➜ Rp 78.000\n' +
        '⏣ **600r**  ➜ Rp 93.600\n' +
        '⏣ **700r**  ➜ Rp 109.200\n' +
        '⏣ **800r**  ➜ Rp 124.800\n' +
        '⏣ **900r**  ➜ Rp 140.400\n' +
        '⏣ **1000r** ➜ Rp 156.000\n' +
        '*(berlaku kelipatan)*\n\n' +
        '📌 **Dibaca yaa :**\n' +
        '• Terima robux langsung masuk tersedia untuk akun yang sudah 18+ / sudah verifikasi identitas (KTP), jadi pastikan akun kalian memenuhi syarat ya!\n' +
        '• Jangan lupa mengaktifkan verifikasi 2 langkah (Authenticator / 2SV) untuk bantu proses terima robux lebih lancar.';
    } else {
      desc =
        '### 🍑 PRICELIST ROBUX VILOG\n\n' +
        '⏣ **80 ROBUX**   ➜ Rp 16.000\n' +
        '⏣ **160 ROBUX**  ➜ Rp 32.000\n' +
        '⏣ **240 ROBUX**  ➜ Rp 48.000\n' +
        '⏣ **320 ROBUX**  ➜ Rp 64.000\n' +
        '⏣ **500 ROBUX**  ➜ Rp 78.500\n' +
        '⏣ **1000 ROBUX** ➜ Rp 157.000\n' +
        '⏣ **1500 ROBUX** ➜ Rp 235.500\n' +
        '*(berlaku kelipatan)*\n\n' +
        '⚡ **Keunggulan & Ketentuan:**\n' +
        '• Proses satset 1–15 menit langsung masuk!\n' +
        '• No limit, beli jumlah banyak pun boleh.';
    }

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
