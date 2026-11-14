const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const path = require('path');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const storeDashboardService = require('./storeDashboardService');

// In-Memory Lock untuk mencegah spam-click pembuatan tiket ganda (Audit CON-01)
const creatingTickets = new Set();
const TICKET_CATEGORY_ID = '1570431160222228541';
const paymentButtons = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('payment_qris_malaysia')
    .setLabel('QRIS Malaysia')
    .setEmoji('🇲🇾')
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId('payment_qris_indonesia')
    .setLabel('QRIS Indonesia')
    .setEmoji('🇮🇩')
    .setStyle(ButtonStyle.Success)
);

/**
 * Service Sistem Tiket Athi Store
 * Menangani pembuatan channel tiket privat, klaim staf, dan pencatatan log transaksi sukses.
 */
class TicketService {
  /**
   * Warna embed default dari env atau fallback peach Athi Store
   */
  getEmbedColor() {
    return process.env.EMBED_COLOR || '#FF8474';
  }

  /**
   * Buat channel tiket baru untuk kategori pesanan/support tertentu
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string} category 'Robux Via Send' | 'Robux Via Login' | 'Gift In Game' | 'Support' | 'Report'
   * @param {Object} [orderDetails] Detail order Robux Via Send
   * @param {string} [orderDetails.robloxUsername] Username Roblox customer
   * @param {{amount: number, price: number}} [orderDetails.packet] Paket yang dipilih
   * @param {string} [orderDetails.gameName] Nama game Gift In Game
   * @param {string} [orderDetails.gamepassType] Jenis gamepass
   * @param {number} [orderDetails.robuxAmount] Jumlah Robux
   * @param {number} [orderDetails.totalPrice] Total harga Gift In Game
   */
  async createTicketChannel(interaction, category, orderDetails = {}) {
    const { guild, user } = interaction;
    const lockKey = `${guild.id}_${user.id}_${category}`;

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const serviceKey = category === 'Robux Via Send'
      ? 'send'
      : category === 'Robux Via Login'
        ? 'login'
        : category === 'Gift In Game'
          ? 'gift'
          : null;
    if (serviceKey && !(await storeDashboardService.getServiceStatus(guild.id, serviceKey))) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔒 Toko Sedang Tutup')
        .setDescription(
          `Layanan **${category}** sedang ditutup oleh staff.\n\n` +
          'Silakan tunggu hingga staff membuka toko kembali.'
        )
        .setFooter({ text: 'Athi Store • Mohon menunggu' })
        .setTimestamp();
      return interaction.editReply({ content: '', embeds: [embed], components: [] });
    }

    if (creatingTickets.has(lockKey)) {
      return interaction.editReply({
        content: '⏳ Tiket kamu sedang dalam proses pembuatan, mohon tunggu sebentar...',
        ephemeral: true
      });
    }

    creatingTickets.add(lockKey);

    try {
      const ticketCategory = guild.channels.cache.get(TICKET_CATEGORY_ID);
      if (!ticketCategory || ticketCategory.type !== ChannelType.GuildCategory) {
        throw new Error(`Kategori tiket ${TICKET_CATEGORY_ID} tidak ditemukan atau bukan category.`);
      }

      // Cek apakah user sudah punya tiket aktif pada kategori yang sama
      const existingTicket = await Ticket.findOne({
        guildId: guild.id,
        userId: user.id,
        category,
        status: { $in: ['OPEN', 'CLAIMED'] }
      });

      if (existingTicket) {
        let channel = guild.channels.cache.get(existingTicket.channelId);
        if (!channel) {
          try {
            channel = await guild.channels.fetch(existingTicket.channelId);
          } catch {}
        }

        if (channel) {
          const response = {
            content: `⚠️ Kamu sudah memiliki tiket **${category}** yang masih aktif di ${channel}!`,
            ephemeral: true
          };
          return interaction.editReply(response);
        } else {
          // Jika channel discord lama sudah dihapus manual, tandai CLOSED di database
          existingTicket.status = 'CLOSED';
          await existingTicket.save();
        }
      }

      // Ambil konfigurasi guild jika ada
      let config = null;
      try {
        config = await GuildConfig.findOne({ guildId: guild.id });
      } catch {}

      const staffRoleId = config?.staffRoleId || process.env.STAFF_ROLE_ID || null;

      // Permission overwrites untuk channel tiket privat
      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ];

      if (staffRoleId && guild.roles.cache.has(staffRoleId)) {
        permissionOverwrites.push({
          id: staffRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        });
      }

      // Generate Ticket ID unik (Audit DAT-01)
      const count = await Ticket.countDocuments();
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const ticketId = `TCK-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;

      // Slug nama channel
      let categorySlug = 'order';
      if (category.toLowerCase().includes('send')) categorySlug = 'send';
      else if (category.toLowerCase().includes('login')) categorySlug = 'login';
      else if (category.toLowerCase().includes('gift')) categorySlug = 'gift';
      else if (category.toLowerCase().includes('support')) categorySlug = 'support';
      else if (category.toLowerCase().includes('report')) categorySlug = 'report';

      const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      const channelName = `ticket-${categorySlug}-${cleanUsername}`;

      // Buat channel tiket
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        topic: `Tiket: ${category} | ID: ${ticketId} | Customer: ${user.tag} (${user.id})`,
        permissionOverwrites
      });

      // Simpan data tiket ke database MongoDB
      await Ticket.create({
        ticketId,
        channelId: channel.id,
        guildId: guild.id,
        userId: user.id,
        userTag: user.tag || user.username,
        category,
        orderNominal: orderDetails.packet
          ? `${orderDetails.packet.amount} Robux`
          : orderDetails.robuxAmount
            ? `${orderDetails.robuxAmount} Robux - ${orderDetails.gameName} - ${orderDetails.gamepassType}`
            : '-',
        orderPrice: orderDetails.packet
          ? `Rp ${orderDetails.packet.price.toLocaleString('id-ID')}`
          : orderDetails.totalPrice
            ? `Rp ${orderDetails.totalPrice.toLocaleString('id-ID')}`
            : '-',
        robuxAmount: orderDetails.packet?.amount || orderDetails.robuxAmount || null,
        gameName: orderDetails.gameName || null,
        gamepassType: orderDetails.gamepassType || null,
        status: 'OPEN'
      });

      // Konten embed sambutan sesuai kategori
      let categoryGuide = '';
      if (category === 'Robux Via Send') {
        categoryGuide =
          '⚡ **Ketentuan & Panduan Robux Via Send (Username):**\n' +
          '• Aktifkan **2-Step Verification** agar penerimaan dapat mencapai limit hingga **10.000 Robux**.\n' +
          '• Pastikan jumlah pesanan sudah sesuai sebelum diproses.\n' +
          (orderDetails.robloxUsername
            ? `• **Username Roblox:** \`${orderDetails.robloxUsername}\``
            : '');
      } else if (category === 'Robux Via Login') {
        categoryGuide =
          '🔐 **Ketentuan & Panduan Robux Via Login (Vilog):**\n' +
          '• Proses super cepat **1–15 Menit** langsung masuk tanpa syarat 18+.\n' +
          '• Bebas beli berapa saja (No Limit).\n' +
          '• Cantumkan username dan password hanya di ticket privat setelah staff resmi menyapa.\n' +
          '• Nonaktifkan sementara verifikasi 2 langkah hanya jika benar-benar diperlukan, lalu aktifkan kembali setelah proses selesai.\n' +
          '• Jangan pernah membagikan kredensial di channel umum atau kepada pihak selain staff resmi.';
      } else if (category === 'Gift In Game') {
        categoryGuide =
          '🎁 **Ketentuan & Panduan Gift In Game (GIG):**\n' +
          '• Berikan nama map atau link map, serta jenis gamepass yang diinginkan.\n' +
          '• Private server sendiri bersifat opsional.' +
          (orderDetails.robloxUsername
            ? `\n• **Username:** \`${orderDetails.robloxUsername}\``
            : '');
      } else {
        categoryGuide = 'Silakan jelaskan kebutuhan, pertanyaan, atau kendala kamu dengan detail.';
      }

      const embedColor = config?.embedColor || this.getEmbedColor();
      const welcomeEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`🍑 Athi Store — Tiket: ${category}`)
        .setDescription(
          `Halo ${user}! Terima kasih telah menghubungi **Athi Store**.\n\n` +
          `${categoryGuide}\n\n` +
          `*Tim staf kami akan segera merespons dan membantu proses transaksi kamu.*`
        )
        .addFields(
          { name: '📋 ID Ticket', value: `\`${ticketId}\``, inline: true },
          { name: '👤 Yang Order', value: `${user} (\`${user.tag}\`)`, inline: true },
          { name: '🛍️ Type Orderan', value: category, inline: true },
          {
            name: '💎 Jumlah Robux',
            value: orderDetails.packet
              ? `${orderDetails.packet.amount.toLocaleString('id-ID')} Robux`
              : orderDetails.robuxAmount
                ? `${orderDetails.robuxAmount.toLocaleString('id-ID')} Robux`
                : 'Menunggu detail',
            inline: true
          },
          {
            name: '💰 Nominal Uang',
            value: orderDetails.packet
              ? `Rp ${orderDetails.packet.price.toLocaleString('id-ID')}`
              : orderDetails.totalPrice
                ? `Rp ${orderDetails.totalPrice.toLocaleString('id-ID')}`
                : 'Menunggu perhitungan',
            inline: true
          },
          { name: '👮 Admin Handle', value: 'Belum ada yang handle', inline: true },
          ...(category === 'Gift In Game'
            ? [
                { name: '🗺️ Nama Map', value: orderDetails.gameName || 'Menunggu detail', inline: true },
                { name: '🎁 Jenis Gamepass', value: orderDetails.gamepassType || 'Menunggu detail', inline: true }
              ]
            : [])
        )
        .setFooter({ text: 'Athi Store • Layanan Cepat, Legal & Terpercaya', iconURL: guild.iconURL() || undefined })
        .setTimestamp();

      const actionButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('Klaim Tiket')
          .setEmoji('🙋')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_close_success_btn')
          .setLabel('Selesai (Sukses)')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_close_request')
          .setLabel('Tutup Tiket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Secondary)
      );

      const pingMessage = staffRoleId ? `<@&${staffRoleId}> ${user}` : `${user}`;
      await channel.send({
        content: pingMessage,
        embeds: [welcomeEmbed],
        components: [actionButtons, paymentButtons]
      });

      await interaction.editReply({
        content: `✅ Tiket kamu berhasil dibuat: ${channel}`,
        embeds: [],
        components: []
      });

      // Perbarui channel antrian di kategori STATUS
      this.updateQueueCounter(guild).catch(() => {});
    } catch (err) {
      console.error('❌ Error createTicketChannel:', err);
      await interaction.editReply({ content: `❌ Gagal membuat tiket: ${err.message}` }).catch(() => {});
    } finally {
      creatingTickets.delete(lockKey);
    }
  }

  /**
   * Staf mengklaim tiket
   * @param {import('discord.js').ButtonInteraction} interaction
   */
  async claimTicket(interaction) {
    const { channel, user, member, guild } = interaction;

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    let config = null;
    try {
      config = await GuildConfig.findOne({ guildId: guild.id });
    } catch {}

    const staffRoleId = config?.staffRoleId || process.env.STAFF_ROLE_ID;
    const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) ||
                    (staffRoleId && member.roles.cache.has(staffRoleId));

    if (!isStaff) {
      return interaction.editReply({
        content: '❌ Hanya staf atau admin Athi Store yang dapat mengklaim tiket ini!',
      });
    }

    const ticket = await Ticket.findOne({ channelId: channel.id });
    if (!ticket) {
      return interaction.editReply({
        content: '❌ Data tiket tidak ditemukan di database.',
      });
    }

    if (ticket.status === 'CLAIMED') {
      return interaction.editReply({
        content: `⚠️ Tiket ini sudah diklaim oleh <@${ticket.claimedBy}>!`,
      });
    }

    ticket.status = 'CLAIMED';
    ticket.claimedBy = user.id;
    ticket.claimedByName = user.tag || user.username;
    await ticket.save();

    await channel.setTopic(
      `Tiket: ${ticket.category} | ID: ${ticket.ticketId} | Dihandle oleh: ${user.tag}`
    );

    try {
      const messages = await channel.messages.fetch({ limit: 20 });
      const ticketMessage = messages.find(
        (message) =>
          message.author.id === interaction.client.user.id &&
          message.embeds[0]?.title?.includes(`Tiket: ${ticket.category}`)
      );

      if (ticketMessage) {
        const embed = EmbedBuilder.from(ticketMessage.embeds[0]);
        const fields = (embed.data.fields || []).map((field) =>
          field.name === '👮 Admin Handle'
            ? { ...field, value: `${user} (\`${user.tag || user.username}\`)` }
            : field
        );
        embed.setFields(fields);
        await ticketMessage.edit({ embeds: [embed] });
      }
    } catch (error) {
      console.warn('⚠️ Gagal memperbarui admin handle pada embed tiket:', error.message);
    }

    const claimEmbed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setDescription(`🙋 **Tiket ini sekarang ditangani oleh ${user}**.\nStaff siap memproses pesanan kamu hingga selesai.`);

    await interaction.editReply({ embeds: [claimEmbed] });
  }

  /**
   * Tutup tiket dengan opsi sukses (catat log transaksi) atau non-sukses (batal/tutup biasa)
   * @param {import('discord.js').ButtonInteraction | import('discord.js').ModalSubmitInteraction} interaction
   * @param {Object} options
   * @param {boolean} options.isSuccess Apakah transaksi sukses
   * @param {string} [options.nominal] Keterangan nominal/paket Robux
   * @param {string} [options.totalPrice] Total nominal Rupiah
   * @param {string} [options.paymentMethod] Metode bayar
   * @param {string} [options.reason] Catatan tambahan
   */
  async closeTicket(interaction, { isSuccess = false, nominal = '-', totalPrice = '-', paymentMethod = '-', reason = 'Selesai dihandle' } = {}) {
    const { channel, user, member, guild } = interaction;

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const ticket = await Ticket.findOne({ channelId: channel.id });
    if (!ticket) {
      return interaction.editReply({
        content: '❌ Data tiket tidak ditemukan di database.',
      });
    }

    if (ticket.status === 'CLOSED') {
      return interaction.editReply({
        content: '⚠️ Tiket ini sudah dalam proses penutupan.',
      });
    }

    // Validasi Otorisasi Penutupan Tiket (Audit SEC-01)
    let config = null;
    try {
      config = await GuildConfig.findOne({ guildId: guild.id });
    } catch {}
    const staffRoleId = config?.staffRoleId || process.env.STAFF_ROLE_ID;
    const isOwner = ticket.userId === user.id;
    const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) ||
                    (staffRoleId && member.roles.cache.has(staffRoleId));

    if (!isOwner && !isStaff) {
      return interaction.editReply({
        content: '❌ Kamu tidak memiliki izin untuk menutup tiket ini!',
      });
    }

    const resolvedNominal =
      nominal !== '-'
        ? nominal
        : ticket.orderNominal !== '-'
          ? ticket.orderNominal
          : ticket.robuxAmount
            ? `${ticket.robuxAmount.toLocaleString('id-ID')} Robux`
            : 'Detail tidak tersedia';
    const resolvedTotalPrice = totalPrice !== '-' ? totalPrice : ticket.orderPrice || 'Detail tidak tersedia';
    const resolvedPaymentMethod = paymentMethod !== '-' ? paymentMethod : ticket.paymentMethod || '-';

    // Update database
    ticket.status = 'CLOSED';
    ticket.isSuccess = isSuccess;
    ticket.orderNominal = resolvedNominal;
    ticket.orderPrice = resolvedTotalPrice;
    ticket.paymentMethod = resolvedPaymentMethod;
    ticket.closedBy = user.id;
    ticket.closedByName = user.tag || user.username;
    ticket.closeReason = reason;
    ticket.closedAt = new Date();
    await ticket.save();

    // PENTING: Jika TRANSAKSI SUKSES, kirim ke channel log-transaksi (1570118698654629958)
    const transactionLogChannelId = process.env.TRANSACTION_LOG_CHANNEL_ID || '1570118698654629958';
    if (isSuccess && transactionLogChannelId) {
      const txChannel = guild.channels.cache.get(transactionLogChannelId);
      if (txChannel) {
        const txEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🧾 Transaction Completed')
          .setDescription(
            `Pesanan telah berhasil diproses oleh Staff **${user.tag || user.username}**.\n` +
            `Terima kasih telah berbelanja di **Athi Store** 🍑`
          )
          .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: '👤 Customer', value: `<@${ticket.userId}>`, inline: true },
            { name: '👮 Staff', value: `<@${ticket.claimedBy || user.id}>`, inline: true },
            { name: '📦 Produk', value: ticket.category, inline: true },
            { name: '🎁 Paket / Nominal', value: resolvedNominal, inline: true },
            { name: '💰 Total', value: resolvedTotalPrice, inline: true },
            { name: '💳 Pembayaran', value: resolvedPaymentMethod, inline: true },
            { name: '🆔 Order ID', value: `\`${ticket.ticketId}\``, inline: true },
            { name: '✅ Status', value: 'Success', inline: true },
            { name: '🕒 Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          );

        if (ticket.category === 'Gift In Game') {
          txEmbed.addFields(
            { name: '🗺️ Nama / Link Map', value: ticket.gameName || 'Tidak tersedia', inline: true },
            { name: '🎮 Jenis Gamepass', value: ticket.gamepassType || 'Tidak tersedia', inline: true },
            { name: '💎 Jumlah Robux', value: ticket.robuxAmount ? `${ticket.robuxAmount.toLocaleString('id-ID')} Robux` : 'Tidak tersedia', inline: true }
          );
        }

        if (reason && reason !== 'Selesai dihandle') {
          txEmbed.addFields({ name: '📝 Catatan', value: reason, inline: false });
        }

        txEmbed
          .setFooter({ text: 'Athi Store • Transaction Log', iconURL: guild.iconURL() || undefined })
          .setTimestamp();

        await txChannel.send({ embeds: [txEmbed] }).catch((e) => {
          console.error('❌ Gagal mengirim log transaksi:', e.message);
        });
      }
    }

    // Kirim notifikasi DM ke customer
    try {
      const customer = await guild.client.users.fetch(ticket.userId);
      if (customer) {
        const dmEmbed = new EmbedBuilder()
          .setColor(isSuccess ? '#2ECC71' : this.getEmbedColor())
          .setTitle(isSuccess ? '🎉 Pesanan Kamu Berhasil Diproses!' : '🔒 Tiket Athi Store Ditutup')
          .setDescription(
            `Halo **${customer.username}**!\n\n` +
            `Tiket kamu (**ID: \`${ticket.ticketId}\`**) pada layanan **${ticket.category}** telah resmi ditutup oleh staf **${user.tag}**.\n\n` +
            (isSuccess
              ? `✅ **Detail Transaksi:**\n` +
                `• **Paket:** ${nominal}\n` +
                `• **Total:** ${totalPrice}\n` +
                `• **Status:** Berhasil & Sukses!\n\n` +
                `⭐ Jangan lupa tinggalkan testimoni / vouch kamu di channel <#1570118786718244995> yaa!\n` +
                `Terima kasih telah berbelanja di **Athi Store**! 🍑`
              : `Terima kasih telah menghubungi **Athi Store**. Sampai jumpa kembali! 🍑`)
          )
          .setTimestamp();

        await customer.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    } catch {}

    // Perbarui counter antrian di STATUS
    this.updateQueueCounter(guild).catch(() => {});

    await interaction.editReply({
      content: isSuccess
        ? '🔒 Transaksi dicatat sebagai **SUKSES ✅**. Mengarsipkan tiket dan menghapus channel dalam 5 detik...'
        : '🔒 Menutup tiket dan mengarsipkan riwayat percakapan dalam 5 detik...'
    }).catch(() => {});

    // Hapus channel tiket setelah 5 detik
    setTimeout(async () => {
      try {
        await channel.delete('Tiket ditutup oleh staff/user');
      } catch (err) {
        console.error('❌ Gagal menghapus channel tiket:', err.message);
      }
    }, 5000);
  }

  /**
   * Memperbarui nama channel antrian tiket di kategori STATUS
   * @param {import('discord.js').Guild} guild
   */
  async updateQueueCounter(guild) {
    try {
      const statusCategoryId = process.env.STATUS_CATEGORY_ID || '1570115256334950440';
      const queueChannel = guild.channels.cache.find(
        (c) => c.parentId === statusCategoryId && c.name.includes('ANTRIAN')
      );

      if (queueChannel) {
        const activeCount = await Ticket.countDocuments({
          guildId: guild.id,
          status: { $in: ['OPEN', 'CLAIMED'] }
        });

        const newName = `🎫 | ANTRIAN: ${activeCount}`;
        if (queueChannel.name !== newName) {
          await queueChannel.setName(newName);
        }
      }
    } catch (err) {
      console.warn('⚠️ Gagal update queue counter:', err.message);
    }
  }
}

module.exports = new TicketService();
