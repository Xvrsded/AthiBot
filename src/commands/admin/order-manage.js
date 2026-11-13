const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Order = require('../../models/Order');
const storeService = require('../../services/storeService');

/**
 * Command: /order-manage
 * Manajemen dan pemantauan pesanan pelanggan Athi Store.
 * Akses: Administrator / ManageGuild
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('order-manage')
    .setDescription('Kelola dan pantau pesanan pelanggan Athi Store')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // Subcommand: List
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Lihat daftar pesanan terbaru')
        .addStringOption((opt) =>
          opt
            .setName('status')
            .setDescription('Filter status pesanan')
            .setRequired(false)
            .addChoices(
              { name: '⏳ PENDING', value: 'PENDING' },
              { name: '✅ ACCEPTED', value: 'ACCEPTED' },
              { name: '🎉 COMPLETED', value: 'COMPLETED' },
              { name: '❌ REJECTED', value: 'REJECTED' }
            )
        )
    )
    // Subcommand: View
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('Lihat detail lengkap dari suatu ID pesanan')
        .addStringOption((opt) =>
          opt.setName('order_id').setDescription('ID Pesanan (contoh: ATHI-12345)').setRequired(true)
        )
    )
    // Subcommand: Set Status
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Ubah status pesanan pelanggan secara manual')
        .addStringOption((opt) =>
          opt.setName('order_id').setDescription('ID Pesanan (contoh: ATHI-12345)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('status_baru')
            .setDescription('Pilih status baru')
            .setRequired(true)
            .addChoices(
              { name: 'ACCEPTED (Diterima)', value: 'ACCEPTED' },
              { name: 'PROCESSING (Diproses)', value: 'PROCESSING' },
              { name: 'COMPLETED (Selesai)', value: 'COMPLETED' },
              { name: 'REJECTED (Ditolak)', value: 'REJECTED' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('alasan').setDescription('Catatan / alasan (khususnya jika ditolak)').setRequired(false)
        )
    ),

  async execute(interaction) {
    const embedColor = process.env.EMBED_COLOR || '#FF8474';
    const subcommand = interaction.options.getSubcommand();

    // 1. LIST PESANAN
    if (subcommand === 'list') {
      const statusFilter = interaction.options.getString('status');
      const query = statusFilter ? { status: statusFilter } : {};
      const orders = await Order.find(query).sort({ createdAt: -1 }).limit(15);

      if (!orders.length) {
        return interaction.reply({
          content: '⚠️ Belum ada pesanan yang ditemukan sesuai filter.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`📋 Daftar Pesanan Pelanggan ${statusFilter ? `[${statusFilter}]` : ''}`)
        .setDescription(
          orders
            .map(
              (o) =>
                `• **\`${o.orderId}\`** — <@${o.userId}> | **${o.productName}** (${o.quantity}x)\n` +
                `  Total: **${storeService.formatRupiah(o.totalPrice)}** | Status: **${o.status}**\n` +
                `  User Roblox: \`${o.robloxUsername}\` | Tanggal: <t:${Math.floor(o.createdAt.getTime() / 1000)}:d>`
            )
            .join('\n\n')
        )
        .setFooter({ text: 'Athi Store • Order Management' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 2. VIEW DETAIL PESANAN
    if (subcommand === 'view') {
      const orderId = interaction.options.getString('order_id').toUpperCase();
      const order = await Order.findOne({ orderId });

      if (!order) {
        return interaction.reply({
          content: `❌ Pesanan dengan ID \`${orderId}\` tidak ditemukan.`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`🔍 Detail Pesanan: [${order.orderId}]`)
        .addFields(
          { name: '👤 Pembeli', value: `<@${order.userId}> (${order.userTag})`, inline: true },
          { name: '📦 Produk', value: `${order.productName} (${order.category})`, inline: true },
          { name: '🔢 Jumlah', value: `${order.quantity}x`, inline: true },
          { name: '💰 Total Harga', value: `**${storeService.formatRupiah(order.totalPrice)}**`, inline: true },
          { name: '🎮 Roblox Username', value: `\`${order.robloxUsername}\``, inline: true },
          { name: '⏳ Status', value: `**${order.status}**`, inline: true },
          { name: '📞 Kontak Tambahan', value: `${order.contactInfo}`, inline: true },
          { name: '📝 Catatan', value: `${order.notes}`, inline: true },
          { name: '👮 Dihandle Oleh', value: order.handledByName || 'Belum dihandle', inline: true },
          { name: '📅 Tanggal Dibuat', value: `<t:${Math.floor(order.createdAt.getTime() / 1000)}:F>`, inline: false }
        );

      if (order.rejectionReason) {
        embed.addFields({ name: '❌ Alasan Penolakan', value: order.rejectionReason, inline: false });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 3. SET STATUS PESANAN
    if (subcommand === 'status') {
      const orderId = interaction.options.getString('order_id').toUpperCase();
      const status = interaction.options.getString('status_baru');
      const reason = interaction.options.getString('alasan') || null;

      try {
        const updated = await storeService.updateOrderStatus(orderId, status, interaction.user, reason);

        // Kirim DM ke user
        try {
          const buyer = await interaction.client.users.fetch(updated.userId);
          if (buyer) {
            const dmEmbed = new EmbedBuilder()
              .setColor(embedColor)
              .setTitle(`📦 Status Pesanan Diperbarui [${orderId}]`)
              .setDescription(
                `Halo ${buyer.username}, status pesanan kamu untuk **${updated.productName}** telah diubah menjadi **${status}** oleh staff ${interaction.user.tag}.` +
                (reason ? `\n\nCatatan: *${reason}*` : '')
              )
              .setTimestamp();
            await buyer.send({ embeds: [dmEmbed] }).catch(() => {});
          }
        } catch {}

        return interaction.reply({
          content: `✅ Status pesanan **${orderId}** berhasil diubah menjadi **${status}**.`,
          ephemeral: true
        });
      } catch (err) {
        return interaction.reply({
          content: `❌ Gagal mengubah status: ${err.message}`,
          ephemeral: true
        });
      }
    }
  }
};

