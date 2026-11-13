const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Product = require('../../models/Product');
const storeService = require('../../services/storeService');

/**
 * Command: /product
 * Manajemen Produk Athi Store (List, Add, Edit, Delete).
 * Akses: Administrator / ManageGuild
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('product')
    .setDescription('Manajemen katalog produk Athi Store')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // Subcommand: List
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Lihat seluruh daftar produk yang tersimpan di database')
        .addStringOption((opt) =>
          opt
            .setName('kategori')
            .setDescription('Filter kategori')
            .setRequired(false)
            .addChoices(
              { name: 'ROBUX VIA USERNAME', value: 'ROBUX VIA USERNAME' },
              { name: 'ROBUX VILOG', value: 'ROBUX VILOG' }
            )
        )
    )
    // Subcommand: Add
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Tambah produk baru ke katalog')
        .addStringOption((opt) =>
          opt
            .setName('kategori')
            .setDescription('Kategori produk')
            .setRequired(true)
            .addChoices(
              { name: 'ROBUX VIA USERNAME', value: 'ROBUX VIA USERNAME' },
              { name: 'ROBUX VILOG', value: 'ROBUX VILOG' }
            )
        )
        .addStringOption((opt) => opt.setName('nama').setDescription('Nama produk (cth: 25r)').setRequired(true))
        .addIntegerOption((opt) => opt.setName('amount').setDescription('Jumlah Robux (cth: 25)').setRequired(true))
        .addIntegerOption((opt) => opt.setName('harga').setDescription('Harga dalam Rupiah (cth: 5000)').setRequired(true))
        .addStringOption((opt) => opt.setName('deskripsi').setDescription('Keterangan singkat').setRequired(false))
    )
    // Subcommand: Edit
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Ubah harga atau status produk berdasarkan ID database')
        .addStringOption((opt) => opt.setName('id').setDescription('ID Produk di MongoDB').setRequired(true))
        .addIntegerOption((opt) => opt.setName('harga_baru').setDescription('Harga baru dalam Rupiah').setRequired(false))
        .addBooleanOption((opt) => opt.setName('aktif').setDescription('Status aktif produk (true/false)').setRequired(false))
    )
    // Subcommand: Delete
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Hapus produk dari database')
        .addStringOption((opt) => opt.setName('id').setDescription('ID Produk di MongoDB').setRequired(true))
    ),

  async execute(interaction) {
    const embedColor = process.env.EMBED_COLOR || '#FF8474';
    const subcommand = interaction.options.getSubcommand();

    // 1. LIST PRODUK
    if (subcommand === 'list') {
      const category = interaction.options.getString('kategori');
      const query = category ? { category } : {};
      const products = await Product.find(query).sort({ category: 1, amount: 1 });

      if (!products.length) {
        return interaction.reply({
          content: '⚠️ Tidak ada produk yang ditemukan di database.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('📦 Daftar Produk Athi Store (Database)')
        .setDescription(
          products
            .map(
              (p, i) =>
                `\`${i + 1}.\` **${p.name}** (${p.category})\n` +
                `• Harga: **${storeService.formatRupiah(p.price)}** | Status: ${p.isActive ? '🟢 Aktif' : '🔴 Nonaktif'}\n` +
                `• ID: \`${p._id}\``
            )
            .slice(0, 25)
            .join('\n\n')
        )
        .setFooter({ text: `Total: ${products.length} produk` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 2. ADD PRODUK
    if (subcommand === 'add') {
      const category = interaction.options.getString('kategori');
      const name = interaction.options.getString('nama');
      const amount = interaction.options.getInteger('amount');
      const price = interaction.options.getInteger('harga');
      const description = interaction.options.getString('deskripsi') || '';

      const newProduct = await Product.create({
        name,
        category,
        amount,
        price,
        description,
        isActive: true
      });

      return interaction.reply({
        content: `✅ Produk berhasil ditambahkan:\n**${newProduct.name}** (${newProduct.category}) — **${storeService.formatRupiah(newProduct.price)}** [ID: \`${newProduct._id}\`]`,
        ephemeral: true
      });
    }

    // 3. EDIT PRODUK
    if (subcommand === 'edit') {
      const id = interaction.options.getString('id');
      const newPrice = interaction.options.getInteger('harga_baru');
      const isActive = interaction.options.getBoolean('aktif');

      const product = await Product.findById(id);
      if (!product) {
        return interaction.reply({
          content: `❌ Produk dengan ID \`${id}\` tidak ditemukan.`,
          ephemeral: true
        });
      }

      if (newPrice !== null) product.price = newPrice;
      if (isActive !== null) product.isActive = isActive;
      await product.save();

      return interaction.reply({
        content: `✅ Produk **${product.name}** berhasil diperbarui:\n• Harga: **${storeService.formatRupiah(product.price)}**\n• Status: ${product.isActive ? '🟢 Aktif' : '🔴 Nonaktif'}`,
        ephemeral: true
      });
    }

    // 4. DELETE PRODUK
    if (subcommand === 'delete') {
      const id = interaction.options.getString('id');
      const product = await Product.findByIdAndDelete(id);

      if (!product) {
        return interaction.reply({
          content: `❌ Produk dengan ID \`${id}\` tidak ditemukan.`,
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `🗑️ Produk **${product.name}** (ID: \`${id}\`) telah dihapus dari database.`,
        ephemeral: true
      });
    }
  }
};

