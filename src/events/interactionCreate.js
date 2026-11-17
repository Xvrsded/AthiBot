const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  AttachmentBuilder
} = require('discord.js');
const path = require('path');
const ticketService = require('../services/ticketService');
const storeService = require('../services/storeService');
const Order = require('../models/Order');
const Product = require('../models/Product');
const GuildConfig = require('../models/GuildConfig');
const storeDashboardService = require('../services/storeDashboardService');

// In-memory storage untuk pending order sebelum dikonfirmasi
const pendingOrders = new Map();
const interactionUpdateDefers = new WeakMap();

async function deferUpdateIfNeeded(interaction) {
  if (interaction.deferred || interaction.replied) return;
  const existingDefer = interactionUpdateDefers.get(interaction);
  if (existingDefer) return existingDefer;

  const deferPromise = interaction.deferUpdate().finally(() => {
    interactionUpdateDefers.delete(interaction);
  });
  interactionUpdateDefers.set(interaction, deferPromise);
  await deferPromise;
}

function formatRupiah(num) {
  return 'Rp ' + num.toLocaleString('id-ID');
}

async function getSendPacket(value) {
  const amount = Number(value.replace('send_', ''));
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return Product.findOne({ category: 'ROBUX VIA USERNAME', amount, isActive: true }).lean();
}

function formatGiftPrice(amount) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function calculateGiftPrice(robux, rate) {
  return Math.ceil(robux * rate / 500) * 500;
}

function isDashboardManager(interaction) {
  return interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function parsePositiveNumber(value, label) {
  const normalized = value.replace(/[.,\s]/g, '');
  const number = Number(normalized);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${label} harus berupa angka bulat 0 atau lebih.`);
  }
  return number;
}

async function ensureServiceOpen(interaction, serviceKey, serviceLabel) {
  const isOpen = await storeDashboardService.getServiceStatus(interaction.guild.id, serviceKey);
  if (isOpen) return true;

  const closedEmbed = new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle('🔒 Toko Sedang Tutup')
    .setDescription(
      `Layanan **${serviceLabel}** sedang ditutup oleh staff.\n\n` +
      'Silakan tunggu hingga staff membuka toko kembali.'
    )
    .setFooter({ text: 'Athi Store • Mohon menunggu' })
    .setTimestamp();

  await interaction.reply({ embeds: [closedEmbed], ephemeral: true });
  return false;
}

async function refreshDashboard(interaction, config = null) {
  return storeDashboardService.updateDashboard(interaction.guild, config);
}

function getPendingOrderDetails(pending) {
  if (pending.packet) {
    return {
      nominal: `${pending.packet.amount} Robux`,
      price: formatRupiah(pending.packet.price),
      robloxUsername: pending.robloxUsername
    };
  }
  if (pending.type === 'gift') {
    return {
      nominal: `${pending.robuxAmount.toLocaleString('id-ID')} Robux`,
      price: formatGiftPrice(pending.totalPrice),
      robloxUsername: pending.robloxUsername,
      gameName: pending.gameName,
      gamepassType: pending.gamepassType
    };
  }
  if (pending.type === 'login') {
    return {
      nominal: `${pending.robuxAmount.toLocaleString('id-ID')} Robux`,
      price: formatRupiah(pending.totalPrice),
      robloxUsername: pending.robloxUsername
    };
  }
  return { nominal: 'Detail menyusul di ticket', price: 'Detail menyusul di ticket' };
}

async function showBulkConfirmation(interaction, pendingKey, pending, ticket) {
  const details = getPendingOrderDetails(pending);
  const embed = new EmbedBuilder()
    .setColor('#F1C40F')
    .setTitle('📦 Ticket Aktif Ditemukan')
    .setDescription(
      `Kamu masih memiliki ticket aktif untuk layanan **${pending.category}** di ${ticket.channelId ? `<#${ticket.channelId}>` : 'ticket lama'}.\n\n` +
      'Apakah order ini ingin ditambahkan sebagai **Bulk Order** ke ticket tersebut?'
    )
    .addFields(
      { name: '💎 Robux / Nominal', value: details.nominal, inline: true },
      { name: '💰 Harga', value: details.price, inline: true },
      ...(details.robloxUsername ? [{ name: '🎮 Username Roblox', value: details.robloxUsername, inline: true }] : []),
      ...(details.gameName ? [{ name: '🗺️ Nama / Link Map', value: details.gameName, inline: true }] : []),
      ...(details.gamepassType ? [{ name: '🎁 Jenis Gamepass', value: details.gamepassType, inline: true }] : [])
    )
    .setFooter({ text: 'Order baru belum ditambahkan sampai kamu menekan Konfirmasi Bulk.' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bulk_confirm_${pendingKey}`)
      .setLabel('✅ Tambahkan ke Ticket')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`bulk_cancel_${pendingKey}`)
      .setLabel('❌ Batalkan')
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function createOrOfferBulkTicket(interaction, category, orderDetails = {}) {
  const serviceKey = category === 'Robux Via Send' ? 'send' : category === 'Robux Via Login' ? 'login' : 'gift';
  if (!(await ensureServiceOpen(interaction, serviceKey, category))) return;

  const activeTicket = await ticketService.findActiveTicket(interaction.guild.id, interaction.user.id, category);
  if (!activeTicket) {
    return ticketService.createTicketChannel(interaction, category, orderDetails);
  }

  const pendingKey = `ticket_${interaction.user.id}_${Date.now()}`;
  pendingOrders.set(pendingKey, {
    type: 'direct',
    category,
    ...orderDetails,
    createdAt: Date.now()
  });
  setTimeout(() => pendingOrders.delete(pendingKey), 5 * 60 * 1000);
  return showBulkConfirmation(interaction, pendingKey, pendingOrders.get(pendingKey), activeTicket);
}

/**
 * Event: InteractionCreate
 * Pusat pengendali semua interaksi Discord (Slash Command, Tombol, Select Menu, Modal).
 */
module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    const embedColor = process.env.EMBED_COLOR || '#FF8474';

    // ============================================================
    // 1. Tangani Slash Commands
    // ============================================================
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({
          content: '❌ Perintah tidak ditemukan atau belum terdaftar.',
          ephemeral: true
        });
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`❌ Error saat menjalankan command /${interaction.commandName}:`, error);
        const replyPayload = {
          content: '⚠️ Terjadi kesalahan saat memproses perintah ini. Silakan coba lagi nanti atau hubungi staff!',
          ephemeral: true
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload).catch(() => {});
        } else {
          await interaction.reply(replyPayload).catch(() => {});
        }
      }
      return;
    }

    // ============================================================
    // 2. Tangani Autocomplete
    // ============================================================
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction, client);
      } catch (err) {
        console.error('❌ Error autocomplete:', err);
      }
      return;
    }

    // ============================================================
    // 3. Tangani Button Interactions
    // ============================================================
    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId.startsWith('store_')) {
        if (!isDashboardManager(interaction)) {
          return interaction.reply({
            content: '❌ Hanya Admin / Manage Server yang dapat mengubah dashboard toko.',
            ephemeral: true
          });
        }

        if (customId === 'store_refresh') {
          await interaction.deferReply({ ephemeral: true });
          const result = await refreshDashboard(interaction);
          return interaction.editReply({
            content:
              `✅ Dashboard, ${result.updatedStatusChannels} channel STATUS, dan ` +
              `${result.updatedOrderPanels} embed panel pricelist berhasil disinkronkan.`
          });
        }

        const statusService = customId.replace('store_toggle_', '');
        if (['send', 'login', 'gift'].includes(statusService)) {
          const current = await storeDashboardService.getServiceStatus(interaction.guild.id, statusService);
          const config = await storeDashboardService.setServiceStatus(
            interaction.guild.id,
            statusService,
            !current
          );
          const result = await refreshDashboard(interaction, config);
          return interaction.reply({
            content:
              `✅ Status **${storeDashboardService.SERVICE_LABELS[statusService]}** sekarang **${!current ? 'OPEN' : 'CLOSED'}**.\n` +
              `🔄 ${result.updatedStatusChannels} channel STATUS diperbarui.`,
            ephemeral: true
          });
        }

        const numericFields = {
          store_stock_send: ['stockViaSend', 'Stock Via Send'],
          store_stock_gift: ['stockGift', 'Stock Gift In Game'],
          store_rate_gift: ['giftRate', 'Rate Gift In Game']
        };
        if (numericFields[customId]) {
          const [field, label] = numericFields[customId];
          const modal = new ModalBuilder()
            .setCustomId(`store_numeric_${field}`)
            .setTitle(`Ubah ${label}`);
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('value')
                .setLabel(`${label} (angka saja)`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Contoh: 23000')
                .setRequired(true)
                .setMaxLength(12)
            )
          );
          return interaction.showModal(modal);
        }

        if (customId === 'store_price_send' || customId === 'store_price_login') {
          const category = customId === 'store_price_send' ? 'ROBUX VIA USERNAME' : 'ROBUX VILOG';
          const products = await storeService.getProducts(category);
          if (!products.length) {
            return interaction.reply({ content: '❌ Belum ada paket harga untuk kategori ini.', ephemeral: true });
          }
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`store_price_select_${category === 'ROBUX VIA USERNAME' ? 'send' : 'login'}`)
            .setPlaceholder('Pilih paket yang ingin diubah...')
            .addOptions(
              products.map((product) => ({
                label: `${product.amount} Robux`,
                description: `Harga saat ini: Rp ${product.price.toLocaleString('id-ID')}`,
                value: product.id
              }))
            );
          return interaction.reply({
            content: `💸 Pilih paket **${category}** yang ingin diubah:`,
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            ephemeral: true
          });
        }
      }

      if (customId === 'payment_qris_malaysia' || customId === 'payment_qris_indonesia') {
        const isMalaysia = customId === 'payment_qris_malaysia';
        const filePath = path.join(
          __dirname,
          '..',
          '..',
          'Public',
          isMalaysia ? 'QR Malay.jpg' : 'QR Indo.png'
        );
        const label = isMalaysia ? 'QRIS Malaysia' : 'QRIS Indonesia';
        await interaction.deferReply({ ephemeral: true });
        return interaction.editReply({
          content: `💳 **${label}**\nSilakan gunakan QRIS berikut untuk pembayaran.`,
          files: [new AttachmentBuilder(filePath)],
          ephemeral: true
        });
      }

      // ----------------------------------------------------------
      // ROBUX VIA SEND: Tombol "Order" → Tampilkan dropdown paket
      // ----------------------------------------------------------
      if (customId === 'send_order_start') {
        if (!(await ensureServiceOpen(interaction, 'send', 'Robux Via Username / Send'))) return;
        const products = await storeService.getProducts('ROBUX VIA USERNAME');
        const options = products.map(p => ({
          label: `${p.amount} Robux — ${formatRupiah(p.price)}`,
          description: 'Berlaku kelipatan',
          value: `send_${p.amount}`
        }));
        if (!options.length) {
          return interaction.reply({ content: '❌ Pricelist Robux Via Send belum tersedia.', ephemeral: true });
        }

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_send_packet')
            .setPlaceholder('Pilih paket Robux yang ingin kamu order...')
            .addOptions(options)
        );

        return interaction.reply({
          content: '🛒 **Pilih paket Robux Via Send yang ingin kamu pesan:**',
          components: [selectRow],
          ephemeral: true
        });
      }

      if (customId === 'gift_order_start') {
        if (!(await ensureServiceOpen(interaction, 'gift', 'Gift In Game'))) return;
        return showGiftOrderModal(interaction);
      }

      if (customId.startsWith('gift_edit_')) {
        if (!(await ensureServiceOpen(interaction, 'gift', 'Gift In Game'))) return;
        return showGiftOrderModal(interaction, customId.replace('gift_edit_', ''));
      }

      if (customId.startsWith('gift_cancel_')) {
        pendingOrders.delete(customId.replace('gift_cancel_', ''));
        return interaction.update({
          content: '❌ Pesanan Gift In Game dibatalkan.',
          embeds: [],
          components: []
        });
      }

      if (customId.startsWith('bulk_cancel_')) {
        pendingOrders.delete(customId.replace('bulk_cancel_', ''));
        return interaction.update({
          content: '❌ Bulk order dibatalkan.',
          embeds: [],
          components: []
        });
      }

      if (customId.startsWith('bulk_confirm_')) {
        const pendingKey = customId.replace('bulk_confirm_', '');
        const pending = pendingOrders.get(pendingKey);
        if (!pending) {
          return interaction.update({
            content: '❌ Data bulk order sudah kadaluarsa. Silakan buat pesanan baru.',
            embeds: [],
            components: []
          });
        }

        const serviceKey = pending.category === 'Robux Via Send'
          ? 'send'
          : pending.category === 'Robux Via Login'
            ? 'login'
            : 'gift';
        if (!(await storeDashboardService.getServiceStatus(interaction.guild.id, serviceKey))) {
          pendingOrders.delete(pendingKey);
          return interaction.update({
            content: '🔒 Toko sedang tutup. Bulk order belum ditambahkan ke ticket.',
            embeds: [],
            components: []
          });
        }

        const activeTicket = await ticketService.findActiveTicket(
          interaction.guild.id,
          interaction.user.id,
          pending.category
        );
        if (!activeTicket) {
          pendingOrders.delete(pendingKey);
          return interaction.update({
            content: '⚠️ Ticket sebelumnya sudah ditutup. Silakan buat order baru.',
            embeds: [],
            components: []
          });
        }

        pendingOrders.delete(pendingKey);
        await deferUpdateIfNeeded(interaction);
        return ticketService.addBulkOrder(interaction, activeTicket, pending.category, pending);
      }

      if (customId.startsWith('gift_confirm_')) {
        const pendingKey = customId.replace('gift_confirm_', '');
        const pending = pendingOrders.get(pendingKey);
        if (!pending) {
          return interaction.update({
            content: '❌ Data pesanan sudah kadaluarsa. Silakan buat pesanan baru.',
            embeds: [],
            components: []
          });
        }

        if (!(await ensureServiceOpen(interaction, 'gift', 'Gift In Game'))) return;
        const activeTicket = await ticketService.findActiveTicket(
          interaction.guild.id,
          interaction.user.id,
          'Gift In Game'
        );
        if (activeTicket) {
          pending.category = 'Gift In Game';
          return showBulkConfirmation(interaction, pendingKey, pending, activeTicket);
        }

        pendingOrders.delete(pendingKey);
        await deferUpdateIfNeeded(interaction);
        await interaction.editReply({
          content: '✅ Pesanan dikonfirmasi. Ticket privat sedang dibuat...',
          embeds: [],
          components: []
        });

        return ticketService.createTicketChannel(interaction, 'Gift In Game', {
          robloxUsername: pending.robloxUsername,
          gameName: pending.gameName,
          gamepassType: pending.gamepassType,
          robuxAmount: pending.robuxAmount,
          totalPrice: pending.totalPrice
        });
      }

      if (customId.startsWith('login_cancel_')) {
        pendingOrders.delete(customId.replace('login_cancel_', ''));
        return interaction.update({
          content: '❌ Pesanan Login dibatalkan.',
          embeds: [],
          components: []
        });
      }

      if (customId.startsWith('login_confirm_')) {
        const pendingKey = customId.replace('login_confirm_', '');
        const pending = pendingOrders.get(pendingKey);
        if (!pending) {
          return interaction.update({
            content: '❌ Data pesanan sudah kadaluarsa. Silakan buat pesanan baru.',
            embeds: [],
            components: []
          });
        }

        if (!(await ensureServiceOpen(interaction, 'login', 'Robux Via Login'))) return;
        const activeTicket = await ticketService.findActiveTicket(
          interaction.guild.id,
          interaction.user.id,
          'Robux Via Login'
        );
        if (activeTicket) {
          return showBulkConfirmation(interaction, pendingKey, pending, activeTicket);
        }

        pendingOrders.delete(pendingKey);
        await deferUpdateIfNeeded(interaction);
        await interaction.editReply({
          content: '✅ Pesanan Login dikonfirmasi. Ticket privat sedang dibuat...',
          embeds: [],
          components: []
        });
        return ticketService.createTicketChannel(interaction, 'Robux Via Login', {
          robloxUsername: pending.robloxUsername,
          robuxAmount: pending.robuxAmount,
          totalPrice: pending.totalPrice
        });
      }

      // ----------------------------------------------------------
      // TIKET: Buat Tiket Berdasarkan Kategori (Login, Gift, Support, Report)
      // ----------------------------------------------------------
      if (customId === 'ticket_create_send') {
        return createOrOfferBulkTicket(interaction, 'Robux Via Send');
      }
      if (customId === 'ticket_create_login') {
        return showLoginOrderModal(interaction);
      }
      if (customId === 'ticket_create_gift') {
        return createOrOfferBulkTicket(interaction, 'Gift In Game');
      }
      if (customId === 'ticket_create_support') {
        return ticketService.createTicketChannel(interaction, 'Support');
      }
      if (customId === 'ticket_create_order') {
        return ticketService.createTicketChannel(interaction, 'Order');
      }
      if (customId === 'ticket_create_report') {
        return ticketService.createTicketChannel(interaction, 'Report');
      }

      // ----------------------------------------------------------
      // TIKET: Klaim Tiket (Staff)
      // ----------------------------------------------------------
      if (customId === 'ticket_claim') {
        return ticketService.claimTicket(interaction);
      }

      // ----------------------------------------------------------
      // TIKET: Selesai & Sukses (Khusus Staff) → Modal input data transaksi
      // ----------------------------------------------------------
      if (customId === 'ticket_close_success_btn') {
        await interaction.deferReply({ ephemeral: true });
        const { member, guild } = interaction;
        let config = null;
        try {
          config = await GuildConfig.findOne({ guildId: guild.id });
        } catch {}
        const staffRoleId = config?.staffRoleId || process.env.STAFF_ROLE_ID;
        const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) ||
                        (staffRoleId && member.roles.cache.has(staffRoleId));

        if (!isStaff) {
          return interaction.editReply({
            content: '❌ Hanya staf atau admin Athi Store yang dapat menyelesaikan transaksi ini!',
          });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_success_confirm')
            .setLabel('Konfirmasi Selesai')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId('ticket_success_cancel')
            .setLabel('Batal')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({
          content: '⚠️ Tandai ticket ini sebagai transaksi sukses menggunakan detail order yang tersimpan?',
          components: [confirmRow],
        });
      }

      if (customId === 'ticket_success_cancel') {
        return interaction.update({
          content: '✅ Penutupan transaksi dibatalkan.',
          components: []
        });
      }

      if (customId === 'ticket_success_confirm') {
        await deferUpdateIfNeeded(interaction);
        return ticketService.closeTicket(interaction, {
          isSuccess: true,
          reason: 'Transaksi berhasil dikonfirmasi oleh staff.'
        });
      }

      // ----------------------------------------------------------
      // TIKET: Tutup Tiket (Biasa, tanpa log transaksi)
      // ----------------------------------------------------------
      if (customId === 'ticket_close_request') {
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_close_confirm')
            .setLabel('Ya, Tutup Sekarang')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
          new ButtonBuilder()
            .setCustomId('ticket_close_cancel')
            .setLabel('Batal')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: '⚠️ Apakah kamu yakin ingin menutup tiket ini? (Penutupan biasa tidak mencatat log transaksi sukses)',
          components: [confirmRow],
          ephemeral: true
        });
      }

      if (customId === 'ticket_close_confirm') {
        await deferUpdateIfNeeded(interaction);
        return ticketService.closeTicket(interaction, {
          isSuccess: false,
          reason: 'Ditutup atas permintaan customer/staf.'
        });
      }

      if (customId === 'ticket_close_cancel') {
        return interaction.update({
          content: '✅ Penutupan tiket dibatalkan.',
          components: []
        });
      }

      // ----------------------------------------------------------
      // ROBUX VIA SEND: Konfirmasi Order → Buat Tiket
      // ----------------------------------------------------------
      if (customId.startsWith('send_confirm_')) {
        const pendingKey = customId.replace('send_confirm_', '');
        const pending = pendingOrders.get(pendingKey);

        if (!pending) {
          return interaction.update({
            content: '❌ Data pesanan sudah kadaluarsa. Silakan buat pesanan baru.',
            embeds: [],
            components: []
          });
        }

        if (!(await ensureServiceOpen(interaction, 'send', 'Robux Via Username / Send'))) return;
        const activeTicket = await ticketService.findActiveTicket(
          interaction.guild.id,
          interaction.user.id,
          'Robux Via Send'
        );
        if (activeTicket) {
          pending.category = 'Robux Via Send';
          return showBulkConfirmation(interaction, pendingKey, pending, activeTicket);
        }

        pendingOrders.delete(pendingKey);

        // Update embed jadi "Pesanan Dikonfirmasi"
        const confirmedEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Pesanan Dikonfirmasi — Athi Store')
          .setDescription(
            `Pesanan kamu telah dikonfirmasi dan tiket privat sedang dibuat!\n\n` +
            `📋 **Ringkasan Pesanan:**\n` +
            `• **Paket:** ${pending.packet.amount} Robux\n` +
            `• **Harga:** **${formatRupiah(pending.packet.price)}**\n` +
            `• **Username Roblox:** \`${pending.robloxUsername}\`\n\n` +
            `⏳ *Mohon tunggu, channel tiket sedang disiapkan...*`
          )
          .setFooter({ text: 'Athi Store • Layanan Cepat & Terpercaya' })
          .setTimestamp();

        await deferUpdateIfNeeded(interaction);
        await interaction.editReply({
          embeds: [confirmedEmbed],
          components: []
        });

        // Buat tiket dengan data pesanan di-attach
        return ticketService.createTicketChannel(interaction, 'Robux Via Send', {
          robloxUsername: pending.robloxUsername,
          packet: pending.packet
        });
      }

      // ----------------------------------------------------------
      // ROBUX VIA SEND: Edit Order → Kembali ke dropdown paket
      // ----------------------------------------------------------
      if (customId.startsWith('send_edit_')) {
        if (!(await ensureServiceOpen(interaction, 'send', 'Robux Via Username / Send'))) return;
        const pendingKey = customId.replace('send_edit_', '');
        pendingOrders.delete(pendingKey);

        const products = await storeService.getProducts('ROBUX VIA USERNAME');
        const options = products.map(p => ({
          label: `${p.amount} Robux — ${formatRupiah(p.price)}`,
          description: 'Berlaku kelipatan',
          value: `send_${p.amount}`
        }));

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_send_packet')
            .setPlaceholder('Pilih paket Robux yang ingin kamu order...')
            .addOptions(options)
        );

        return interaction.update({
          content: '✏️ **Silakan pilih ulang paket Robux Via Send:**',
          embeds: [],
          components: [selectRow]
        });
      }

      // ----------------------------------------------------------
      // ROBUX VIA SEND: Cancel Order
      // ----------------------------------------------------------
      if (customId.startsWith('send_cancel_')) {
        const pendingKey = customId.replace('send_cancel_', '');
        pendingOrders.delete(pendingKey);

        return interaction.update({
          content: '❌ Pesanan telah dibatalkan. Kamu bisa membuat pesanan baru kapan saja!',
          embeds: [],
          components: []
        });
      }

      // ----------------------------------------------------------
      // SHOP: Tombol Pesan Langsung dari /pricelist
      // ----------------------------------------------------------
      if (customId === 'shop_order_direct') {
        await interaction.deferReply({ ephemeral: true });
        const products = await storeService.getProducts();
        if (!products.length) {
          return interaction.editReply({
            content: '⚠️ Belum ada produk aktif yang tersedia di katalog.',
          });
        }

        const options = products.slice(0, 25).map((p) => ({
          label: `${p.name} - ${storeService.formatRupiah(p.price)}`,
          description: `${p.category} | ${p.description || 'Proses cepat dan aman'}`,
          value: p._id.toString()
        }));

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_order_product')
            .setPlaceholder('Pilih paket Robux yang ingin kamu order...')
            .addOptions(options)
        );

        return interaction.editReply({
          content: '🛒 **Silakan pilih paket Robux yang ingin kamu pesan:**',
          components: [selectRow],
        });
      }

      // ----------------------------------------------------------
      // ORDER MANAGEMENT OLEH STAFF: Accept, Reject, Complete
      // ----------------------------------------------------------
      if (customId.startsWith('order_accept_')) {
        const orderId = customId.replace('order_accept_', '');
        return handleStaffOrderAction(interaction, orderId, 'ACCEPTED');
      }

      if (customId.startsWith('order_complete_')) {
        const orderId = customId.replace('order_complete_', '');
        return handleStaffOrderAction(interaction, orderId, 'COMPLETED');
      }

      if (customId.startsWith('order_reject_')) {
        const orderId = customId.replace('order_reject_', '');

        const modal = new ModalBuilder()
          .setCustomId(`modal_reject_${orderId}`)
          .setTitle(`Tolak Pesanan ${orderId}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reject_reason')
              .setLabel('Alasan Penolakan')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Contoh: Akun belum memenuhi syarat 18+, stok habis, dsb.')
              .setRequired(true)
              .setMaxLength(300)
          )
        );

        return interaction.showModal(modal);
      }
    }

    // ============================================================
    // 4. Tangani String Select Menus
    // ============================================================
    if (interaction.isStringSelectMenu()) {
      const { customId, values } = interaction;

      // ----------------------------------------------------------
      // ROBUX VIA SEND: User memilih paket → Modal input username
      // ----------------------------------------------------------
      if (customId === 'select_send_packet') {
        const selectedValue = values[0];
        const packet = await getSendPacket(selectedValue);

        if (!packet) {
          return interaction.reply({ content: '❌ Paket tidak ditemukan.', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId(`modal_send_username_${selectedValue}`)
          .setTitle(`Order: ${packet.amount} Robux`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('send_roblox_user')
              .setLabel('Username Roblox')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Masukkan Username Roblox kamu yang benar')
              .setRequired(true)
              .setMaxLength(50)
          )
        );

        return interaction.showModal(modal);
      }

      // ----------------------------------------------------------
      // Select Menu: Kategori di /pricelist
      // ----------------------------------------------------------
      if (customId === 'select_pricelist_category') {
        const selectedCategory = values[0];
        await deferUpdateIfNeeded(interaction);
        const products = await storeService.getProducts(selectedCategory);

        let desc = `### 🍑 Katalog: ${selectedCategory}\n\n`;

        if (selectedCategory === 'ROBUX VIA USERNAME') {
          desc += '⏣ **Daftar Harga Robux via Username:**\n';
          products.forEach((p) => {
            desc += `⏣ **${p.amount}r** ➜ ${storeService.formatRupiah(p.price)}\n`;
          });
          desc += '\n*(berlaku kelipatan)*\n\n';
          desc += '📌 **Dibaca yaa:**\n';
          desc += '• Terima robux langsung masuk tersedia untuk akun yang sudah 18+ / sudah verifikasi identitas (KTP).\n';
          desc += '• Jangan lupa mengaktifkan verifikasi 2 langkah (Authenticator / 2SV).\n';
        } else if (selectedCategory === 'ROBUX VILOG') {
          desc += '⏣ **Daftar Harga Robux Vilog:**\n';
          products.forEach((p) => {
            desc += `⏣ **${p.amount} ROBUX** ➜ ${storeService.formatRupiah(p.price)}\n`;
          });
          desc += '\n*(berlaku kelipatan)*\n\n';
          desc += '⚡ **Ketentuan & Keunggulan:**\n';
          desc += '• Proses satset 1–15 menit langsung masuk!\n';
          desc += '• No limit, beli jumlah banyak pun boleh.\n';
        }

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('🍑 Athi Store - Pricelist Robux Terpercaya')
          .setDescription(desc)
          .setFooter({ text: 'Athi Store • Garansi Aman & Legal', iconURL: interaction.guild?.iconURL() || undefined })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ----------------------------------------------------------
      // Select Menu: Memilih Produk untuk Diorder (dari /order atau /pricelist)
      // ----------------------------------------------------------
      if (customId === 'select_order_product') {
        const productId = values[0];
        const product = await storeService.getProductById(productId);

        if (!product) {
          return interaction.reply({ content: '❌ Produk tidak ditemukan.', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId(`modal_order_${productId}`)
          .setTitle(`Order: ${product.name.slice(0, 30)}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('order_roblox_user')
              .setLabel('Username Roblox')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Masukkan Username Roblox kamu yang benar')
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('order_quantity')
              .setLabel('Jumlah / Kelipatan Paket')
              .setStyle(TextInputStyle.Short)
              .setValue('1')
              .setPlaceholder('Contoh: 1 (atau kelipatannya)')
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('order_contact')
              .setLabel('No WhatsApp / Kontak Tambahan')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Contoh: 08123456789')
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('order_notes')
              .setLabel('Catatan Tambahan (Opsional)')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Tuliskan catatan khusus jika ada')
              .setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }

      if (customId.startsWith('store_price_select_')) {
        const product = await Product.findById(values[0]);
        if (!product) {
          return interaction.reply({ content: '❌ Paket harga tidak ditemukan.', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId(`store_price_${product.id}`)
          .setTitle(`Ubah Harga ${product.amount} Robux`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('price')
              .setLabel('Harga baru (angka saja)')
              .setStyle(TextInputStyle.Short)
              .setValue(String(product.price))
              .setPlaceholder('Contoh: 15600')
              .setRequired(true)
              .setMaxLength(12)
          )
        );
        return interaction.showModal(modal);
      }
    }

    // ============================================================
    // 5. Tangani Modal Submit
    // ============================================================
    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      // ----------------------------------------------------------
      // ROBUX VIA SEND: User submit username → Tampilkan konfirmasi
      // ----------------------------------------------------------
      if (customId.startsWith('modal_send_username_')) {
        const packetValue = customId.replace('modal_send_username_', '');
        const packet = await getSendPacket(packetValue);
        const robloxUsername = interaction.fields.getTextInputValue('send_roblox_user').trim();

        if (!packet) {
          return interaction.reply({ content: '❌ Paket tidak ditemukan.', ephemeral: true });
        }

        if (!robloxUsername || robloxUsername.length < 3) {
          return interaction.reply({
            content: '❌ Username Roblox harus minimal 3 karakter!',
            ephemeral: true
          });
        }

        // Simpan data pending order ke memory
        const pendingKey = `${interaction.user.id}_${Date.now()}`;
        pendingOrders.set(pendingKey, {
          userId: interaction.user.id,
          robloxUsername,
          packet,
          createdAt: Date.now()
        });

        // Hapus pending order setelah 5 menit otomatis
        setTimeout(() => pendingOrders.delete(pendingKey), 5 * 60 * 1000);

        // Embed Konfirmasi Pesanan
        const confirmEmbed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('📋 Konfirmasi Pesanan — Athi Store')
          .setDescription(
            `Silakan periksa kembali detail pesanan kamu sebelum mengonfirmasi:\n\n` +
            `⚡ **Layanan:** Robux Via Send (Username)\n` +
            `💎 **Paket:** **${packet.amount} Robux**\n` +
            `💰 **Harga:** **${formatRupiah(packet.price)}**\n` +
            `🎮 **Username Roblox:** \`${robloxUsername}\`\n\n` +
            `📌 **Pastikan:**\n` +
            `• Username Roblox kamu **sudah benar**.\n` +
            `• Akun sudah **18+ / terverifikasi KTP** dan **2-Step Verification aktif**.\n\n` +
            `Setelah dikonfirmasi, tiket pesanan privat akan otomatis dibuat untuk kamu.`
          )
          .setFooter({ text: 'Athi Store • Pesanan belum diproses sampai dikonfirmasi' })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`send_confirm_${pendingKey}`)
            .setLabel('✅ Konfirmasi Order')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`send_edit_${pendingKey}`)
            .setLabel('✏️ Edit Pesanan')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`send_cancel_${pendingKey}`)
            .setLabel('❌ Batalkan')
            .setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({
          embeds: [confirmEmbed],
          components: [actionRow],
          ephemeral: true
        });
      }

      if (customId.startsWith('store_numeric_') || customId.startsWith('store_price_')) {
        if (!isDashboardManager(interaction)) {
          return interaction.reply({
            content: '❌ Hanya Admin / Manage Server yang dapat mengubah dashboard toko.',
            ephemeral: true
          });
        }

        try {
          if (customId.startsWith('store_numeric_')) {
            const field = customId.replace('store_numeric_', '');
            const allowedFields = ['stockViaSend', 'stockGift', 'giftRate'];
            if (!allowedFields.includes(field)) throw new Error('Field dashboard tidak valid.');
            const value = parsePositiveNumber(interaction.fields.getTextInputValue('value'), field);
            const config = await storeDashboardService.setNumericValue(interaction.guild.id, field, value);
            await refreshDashboard(interaction, config);
            return interaction.reply({ content: '✅ Nilai dashboard berhasil diperbarui.', ephemeral: true });
          }

          const productId = customId.replace('store_price_', '');
          const price = parsePositiveNumber(interaction.fields.getTextInputValue('price'), 'Harga');
          const product = await Product.findByIdAndUpdate(
            productId,
            { $set: { price } },
            { new: true }
          );
          if (!product) throw new Error('Paket harga tidak ditemukan.');
          const result = await refreshDashboard(interaction);
          return interaction.reply({
            content:
              `✅ Harga **${product.amount} Robux** diubah menjadi **Rp ${price.toLocaleString('id-ID')}**.\n` +
              `🔄 ${result.updatedOrderPanels} embed panel pricelist ikut diperbarui.`,
            ephemeral: true
          });
        } catch (error) {
          return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
        }
      }

      if (customId.startsWith('modal_gift_order')) {
        const robloxUsername = interaction.fields.getTextInputValue('gift_roblox_user').trim();
        const gameName = interaction.fields.getTextInputValue('gift_game_name').trim();
        const gamepassType = interaction.fields.getTextInputValue('gift_gamepass_type').trim();
        const rawRobux = interaction.fields.getTextInputValue('gift_robux_amount').trim();
        const robuxAmount = Number(rawRobux);

        if (!robloxUsername || !gameName || !gamepassType || !Number.isInteger(robuxAmount) || robuxAmount <= 0) {
          return interaction.reply({
            content: '❌ Username, nama game, jenis gamepass wajib diisi dan jumlah Robux harus berupa angka bulat positif.',
            ephemeral: true
          });
        }

        if (customId === 'modal_login_order') {
          const robloxUsername = interaction.fields.getTextInputValue('login_roblox_user').trim();
          const rawRobux = interaction.fields.getTextInputValue('login_robux_amount').trim();
          const rawPrice = interaction.fields.getTextInputValue('login_price').trim();
          const robuxAmount = Number(rawRobux);
          const totalPrice = Number(rawPrice.replace(/[.,\s]/g, ''));

          if (
            !robloxUsername ||
            !Number.isInteger(robuxAmount) ||
            robuxAmount <= 0 ||
            !Number.isInteger(totalPrice) ||
            totalPrice < 0
          ) {
            return interaction.reply({
              content: '❌ Username, jumlah Robux, dan nominal harga harus diisi dengan angka yang valid.',
              ephemeral: true
            });
          }

          const pendingKey = `${interaction.user.id}_${Date.now()}`;
          pendingOrders.set(pendingKey, {
            type: 'login',
            category: 'Robux Via Login',
            userId: interaction.user.id,
            robloxUsername,
            robuxAmount,
            totalPrice,
            createdAt: Date.now()
          });
          setTimeout(() => pendingOrders.delete(pendingKey), 5 * 60 * 1000);

          const confirmEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle('📋 Konfirmasi Pesanan Robux Via Login')
            .setDescription(
              `🎮 **Username:** \`${robloxUsername}\`\n` +
              `💎 **Jumlah Robux:** ${robuxAmount.toLocaleString('id-ID')} Robux\n` +
              `💰 **Total Harga:** ${formatRupiah(totalPrice)}\n\n` +
              'Setelah dikonfirmasi, ticket baru dibuat atau order ditambahkan sebagai bulk ke ticket Login yang masih aktif.'
            )
            .setTimestamp();
          const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`login_confirm_${pendingKey}`)
              .setLabel('✅ Konfirmasi Order')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`login_cancel_${pendingKey}`)
              .setLabel('❌ Batalkan')
              .setStyle(ButtonStyle.Danger)
          );
          return interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
        }

        const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
        const giftRate = config?.giftRate ?? 95;
        const totalPrice = calculateGiftPrice(robuxAmount, giftRate);
        const pendingKey = `${interaction.user.id}_${Date.now()}`;
        pendingOrders.set(pendingKey, {
          type: 'gift',
          userId: interaction.user.id,
          robloxUsername,
          gameName,
          gamepassType,
          robuxAmount,
          totalPrice,
          createdAt: Date.now()
        });
        setTimeout(() => pendingOrders.delete(pendingKey), 5 * 60 * 1000);

        const confirmEmbed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('📋 Konfirmasi Pesanan Gift In Game — Athi Store')
          .setDescription(
            'Silakan periksa kembali detail pesanan kamu:\n\n' +
            `🎮 **Username:** \`${robloxUsername}\`\n` +
            `🕹️ **Nama Game:** ${gameName}\n` +
            `🎁 **Jenis Gamepass:** ${gamepassType}\n` +
            `💎 **Total Robux:** ${robuxAmount.toLocaleString('id-ID')} Robux\n` +
            `💰 **Total Harga:** **${formatGiftPrice(totalPrice)}**\n\n` +
            `Rate: **1 Robux = Rp ${giftRate.toLocaleString('id-ID')}**. Harga dibulatkan ke atas ke nominal genap kelipatan Rp500.`
          )
          .setFooter({ text: 'Athi Store • Pesanan belum diproses sampai dikonfirmasi' })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`gift_confirm_${pendingKey}`)
            .setLabel('✅ Konfirmasi Order')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`gift_edit_${pendingKey}`)
            .setLabel('✏️ Edit Pesanan')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`gift_cancel_${pendingKey}`)
            .setLabel('❌ Batalkan')
            .setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({
          embeds: [confirmEmbed],
          components: [actionRow],
          ephemeral: true
        });
      }

      // ----------------------------------------------------------
      // Submit Pesanan Baru (dari /order atau /pricelist)
      // ----------------------------------------------------------
      if (customId.startsWith('modal_order_')) {
        const productId = customId.replace('modal_order_', '');
        const robloxUsername = interaction.fields.getTextInputValue('order_roblox_user').trim();
        const rawQty = interaction.fields.getTextInputValue('order_quantity').trim();
        const contactInfo = interaction.fields.getTextInputValue('order_contact')?.trim() || '-';
        const notes = interaction.fields.getTextInputValue('order_notes')?.trim() || '-';

        const quantity = parseInt(rawQty, 10);
        if (isNaN(quantity) || quantity <= 0) {
          return interaction.reply({
            content: '❌ Jumlah pesanan harus berupa angka bulat positif (minimal 1)!',
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const order = await storeService.createOrder({
            userId: interaction.user.id,
            userTag: interaction.user.tag || interaction.user.username,
            productId,
            quantity,
            robloxUsername,
            contactInfo,
            notes
          });

          const confirmationEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle('🎉 Pesanan Berhasil Dibuat! - Athi Store')
            .setDescription(
              `Terima kasih sudah memesan di **Athi Store**!\n` +
              `Pesanan kamu telah masuk ke sistem kami dan sedang menunggu konfirmasi staff.\n\n` +
              `📋 **Detail Pesanan:**\n` +
              `• **ID Pesanan:** \`${order.orderId}\`\n` +
              `• **Produk:** ${order.productName}\n` +
              `• **Jumlah:** ${order.quantity}x\n` +
              `• **Total Harga:** **${storeService.formatRupiah(order.totalPrice)}**\n` +
              `• **Username Roblox:** \`${order.robloxUsername}\`\n` +
              `• **Status:** ⏳ **PENDING**\n\n` +
              `ℹ️ *Kamu akan menerima notifikasi/DM saat status pesanan diperbarui oleh staff.*`
            )
            .setFooter({ text: 'Athi Store • Layanan Cepat & Terpercaya' })
            .setTimestamp();

          await interaction.editReply({ embeds: [confirmationEmbed] });

          // Kirim Notifikasi ke Channel Log Order untuk Staff
          let config = null;
          try {
            config = await GuildConfig.findOne({ guildId: interaction.guild?.id });
          } catch {}

          const orderLogChannelId = config?.orderLogChannelId || process.env.ORDER_LOG_CHANNEL_ID;
          if (orderLogChannelId && interaction.guild) {
            const logChannel = interaction.guild.channels.cache.get(orderLogChannelId);
            if (logChannel) {
              const staffNotificationEmbed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle(`🔔 Pesanan Baru Masuk: [${order.orderId}]`)
                .setDescription(
                  `👤 **Pembeli:** <@${order.userId}> (${order.userTag})\n` +
                  `📦 **Paket:** ${order.productName} (${order.category})\n` +
                  `🔢 **Jumlah:** ${order.quantity}x\n` +
                  `💰 **Total:** **${storeService.formatRupiah(order.totalPrice)}**\n` +
                  `🎮 **Roblox Username:** \`${order.robloxUsername}\`\n` +
                  `📞 **Kontak:** ${order.contactInfo}\n` +
                  `📝 **Catatan:** ${order.notes}\n` +
                  `⏳ **Status:** PENDING`
                )
                .setTimestamp();

              const staffButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`order_accept_${order.orderId}`)
                  .setLabel('Terima (Accept)')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('✅'),
                new ButtonBuilder()
                  .setCustomId(`order_complete_${order.orderId}`)
                  .setLabel('Selesai (Complete)')
                  .setStyle(ButtonStyle.Success)
                  .setEmoji('🎉'),
                new ButtonBuilder()
                  .setCustomId(`order_reject_${order.orderId}`)
                  .setLabel('Tolak (Reject)')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('❌')
              );

              const staffRoleId = config?.staffRoleId || process.env.STAFF_ROLE_ID;
              const content = staffRoleId ? `<@&${staffRoleId}> 📢 Pesanan baru siap diproses!` : '📢 Pesanan baru siap diproses!';
              await logChannel.send({ content, embeds: [staffNotificationEmbed], components: [staffButtons] });
            }
          }
        } catch (err) {
          console.error('❌ Gagal membuat order:', err);
          await interaction.editReply({
            content: `❌ Gagal memproses pesanan: ${err.message}`
          });
        }
        return;
      }

      // ----------------------------------------------------------
      // Penolakan Pesanan dengan Alasan
      // ----------------------------------------------------------
      if (customId.startsWith('modal_reject_')) {
        const orderId = customId.replace('modal_reject_', '');
        const reason = interaction.fields.getTextInputValue('reject_reason').trim();
        return handleStaffOrderAction(interaction, orderId, 'REJECTED', reason);
      }

    }
  }
};

/**
 * Helper untuk Staff mengupdate status pesanan via Button
 */
async function handleStaffOrderAction(interaction, orderId, status, reason = null) {
  const { member, user, guild } = interaction;

  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isModalSubmit()) {
      await interaction.deferReply({ ephemeral: true });
    } else {
      await interaction.deferUpdate();
    }
  }

  let config = null;
  try {
    config = await GuildConfig.findOne({ guildId: guild?.id });
  } catch {}
  const staffRoleId = config?.staffRoleId || process.env.STAFF_ROLE_ID;
  const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) ||
                  (staffRoleId && member.roles.cache.has(staffRoleId));

  if (!isStaff) {
    return interaction.editReply({
      content: '❌ Hanya staf atau admin Athi Store yang dapat mengubah status pesanan ini!',
    });
  }

  try {
    const updatedOrder = await storeService.updateOrderStatus(orderId, status, user, reason);

    const statusColors = {
      ACCEPTED: '#3498DB',
      PROCESSING: '#9B59B6',
      COMPLETED: '#2ECC71',
      REJECTED: '#E74C3C'
    };

    const statusLabels = {
      ACCEPTED: 'Diterima & Sedang Diproses',
      PROCESSING: 'Dalam Pengiriman Robux',
      COMPLETED: 'Selesai Sukses 🎉',
      REJECTED: 'Ditolak / Dibatalkan ❌'
    };

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(statusColors[status] || '#95A5A6')
      .setDescription(
        interaction.message.embeds[0].description +
        `\n\n**Update Status:**\n• Status: **${statusLabels[status]}**\n• Dihandle oleh: ${user} (${user.tag})` +
        (reason ? `\n• Alasan: *${reason}*` : '')
      );

    if (status === 'COMPLETED' || status === 'REJECTED') {
      await interaction.editReply({ embeds: [updatedEmbed], components: [] });
    } else {
      await interaction.editReply({ embeds: [updatedEmbed] });
    }

    try {
      const buyer = await interaction.client.users.fetch(updatedOrder.userId);
      if (buyer) {
        const dmEmbed = new EmbedBuilder()
          .setColor(statusColors[status] || '#FF8474')
          .setTitle(`📦 Update Status Pesanan [${orderId}] - Athi Store`)
          .setDescription(
            `Halo ${buyer.username}!\n` +
            `Status pesanan kamu untuk **${updatedOrder.productName}** (${updatedOrder.quantity}x) telah diperbarui:\n\n` +
            `• **Status Sekarang:** **${statusLabels[status]}**\n` +
            `• **Dihandle Oleh:** ${user.tag}\n` +
            (reason ? `• **Catatan / Alasan:** ${reason}\n\n` : '\n') +
            (status === 'COMPLETED' ? 'Terima kasih telah berbelanja di **Athi Store**! 🍑 Jangan lupa mampir lagi ya!' : '')
          )
          .setTimestamp();

        await buyer.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    } catch {}
  } catch (err) {
    console.error('❌ Gagal mengubah status pesanan:', err);
    await interaction.editReply({
      content: `❌ Gagal mengubah status pesanan: ${err.message}`,
    });
  }
}

function showGiftOrderModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_gift_order')
    .setTitle('Order Gift In Game');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('gift_robux_amount')
        .setLabel('Jumlah Robux')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Contoh: 100')
        .setRequired(true)
        .setMaxLength(12)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('gift_game_name')
        .setLabel('Nama / Link Map')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Contoh: Blox Fruits atau link map')
        .setRequired(true)
        .setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('gift_gamepass_type')
        .setLabel('Jenis Gamepass')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Contoh: 2x Money')
        .setRequired(true)
        .setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('gift_roblox_user')
        .setLabel('Username Roblox')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Masukkan username Roblox')
        .setRequired(true)
        .setMaxLength(50)
    )
  );

  return interaction.showModal(modal);
}

function showLoginOrderModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_login_order')
    .setTitle('Order Robux Via Login');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('login_roblox_user')
        .setLabel('Username Roblox')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Masukkan username Roblox')
        .setRequired(true)
        .setMaxLength(50)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('login_robux_amount')
        .setLabel('Jumlah Robux')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Contoh: 1000')
        .setRequired(true)
        .setMaxLength(12)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('login_price')
        .setLabel('Total harga (angka saja)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Contoh: 157000')
        .setRequired(true)
        .setMaxLength(12)
    )
  );

  return interaction.showModal(modal);
}
