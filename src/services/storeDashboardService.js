const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const Product = require('../models/Product');

const DASHBOARD_CHANNEL_ID = '1571074377842298920';
const STATUS_CATEGORY_ID = process.env.STATUS_CATEGORY_ID || '1570115256334950440';
const SERVICE_CHANNELS = {
  send: process.env.CHANNEL_ROBUX_SEND || '1570117678184661203',
  login: process.env.CHANNEL_ROBUX_LOGIN || '1570117871823098037',
  gift: process.env.CHANNEL_GIFT_GAME || '1570117951875584070'
};
const SERVICE_LABELS = {
  send: 'Robux Via Username / Send',
  login: 'Robux Via Login',
  gift: 'Gift In Game'
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function statusLabel(isOpen) {
  return isOpen ? '✅ OPEN' : '❌ CLOSED';
}

function createButton(customId, label, style) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

function formatProductPriceList(products, label = 'Robux') {
  return products
    .map((product) => `⏣ **${product.amount} ${label}** ➜ Rp ${product.price.toLocaleString('id-ID')}`)
    .join('\n');
}

function buildPanelDescription(service, products, config) {
  if (service === 'send') {
    return (
      'Selamat datang di layanan pemesanan **Robux Via Send (Username)** resmi **Athi Store**!\n' +
      'Metode pengiriman Robux langsung masuk ke saldo akun Roblox kamu dengan cepat, aman, dan 100% legal.\n\n' +
      '📌 **Ketentuan & Syarat Akun:**\n' +
      '• Akun Roblox wajib sudah **berusia 18+** atau **terverifikasi identitas (KTP)**.\n' +
      '• Wajib mengaktifkan **2-Step Verification** (Authenticator / Email) untuk kelancaran transaksi.\n' +
      '• Robux langsung masuk instan tanpa waktu pending.\n' +
      '• Pembelian bebas berlaku kelipatan!\n\n' +
      '🍑 **ROBUX VIA USERNAME**\n\n' +
      formatProductPriceList(products) +
      '\n*(berlaku kelipatan)*\n\n' +
      '📌 **Dibaca yaa:**\n' +
      '• Terima robux langsung masuk tersedia untuk akun yang sudah 18+ / sudah verifikasi identitas (KTP).\n' +
      '• Jangan lupa mengaktifkan verifikasi 2 langkah (Authenticator / 2SV).\n\n' +
      '👇 **Klik tombol Order di bawah untuk memilih paket dan membuat pesanan!**'
    );
  }

  if (service === 'login') {
    return (
      'Selamat datang di layanan **Robux Via Login (Vilog)** resmi **Athi Store**!\n' +
      'Solusi terbaik bagi kamu yang ingin Robux super cepat tanpa ribet verifikasi akun.\n\n' +
      '⚡ **Keunggulan & Ketentuan Layanan:**\n' +
      '• Proses kilat **1–15 Menit** langsung masuk!\n' +
      '• **Tanpa syarat 18+ / KTP**, semua akun Roblox baru/lama bisa order.\n' +
      '• **No Limit**, bebas beli dalam jumlah banyak berapapun.\n' +
      '• Keamanan akun terjamin **100% Aman & Terpercaya**.\n' +
      '• Akun Roblox langsung di-logout oleh tim setelah proses pengisian selesai.\n\n' +
      '💎 **Daftar Harga Vilog:**\n' +
      formatProductPriceList(products) +
      '\n\n⚠️ *Harap jangan memberikan password di channel umum. Klik tombol tiket di bawah untuk membuat room privat dengan staf!*'
    );
  }

  return (
    'Selamat datang di layanan **Gift In Game (GIG) & Gamepass** resmi **Athi Store**!\n' +
    'Beli item game impian, Gamepass, Private Server, atau gift in-game favorit kamu dengan harga murah dan proses aman.\n\n' +
    '🌟 **Keunggulan Layanan:**\n' +
    '• Mendukung berbagai game Roblox populer (Blox Fruits, Pet Simulator 99, King Legacy, dll).\n' +
    '• Pengiriman cepat via Gift Gamepass, Private Server, atau Trade In-Game.\n' +
    '• Garansi aman, legal, dan bebas resiko.\n' +
    '• Tim staf siap memandu langkah demi langkah hingga item berhasil kamu terima.\n\n' +
    `💰 **Rate:** 1 Robux = Rp ${Number(config.giftRate || 0).toLocaleString('id-ID')}\n` +
    `💡 Total harga dihitung dari jumlah Robux × Rp ${Number(config.giftRate || 0).toLocaleString('id-ID')} dan dibulatkan ke atas ke kelipatan Rp500.\n\n` +
    '📝 **Data yang perlu diisi:**\n' +
    '• Jumlah Robux\n• Nama atau link map\n• Jenis gamepass\n• Username Roblox\n\n' +
    '👇 **Klik tombol di bawah ini untuk memulai pemesanan!**'
  );
}

async function updateOrderPanelEmbeds(guild, config) {
  const [sendProducts, loginProducts] = await Promise.all([
    Product.find({ category: 'ROBUX VIA USERNAME', isActive: true }).sort({ sortOrder: 1, amount: 1 }).lean(),
    Product.find({ category: 'ROBUX VILOG', isActive: true }).sort({ sortOrder: 1, amount: 1 }).lean()
  ]);
  const panels = [
    { service: 'send', title: '⚡ ORDER ROBUX VIA SEND (USERNAME) — ATHI STORE', products: sendProducts },
    { service: 'login', title: '🔐 ORDER ROBUX VIA LOGIN (VILOG) — ATHI STORE', products: loginProducts },
    { service: 'gift', title: '🎁 ORDER GIFT IN GAME (GIG) — ATHI STORE', products: [] }
  ];
  let updatedCount = 0;

  for (const panel of panels) {
    const channel = await guild.channels.fetch(SERVICE_CHANNELS[panel.service]).catch(() => null);
    if (!channel?.isTextBased()) continue;
    const messages = await channel.messages.fetch({ limit: 50 });
    const message = messages.find(
      (item) => item.author.id === guild.client.user.id && item.embeds[0]?.title === panel.title
    );
    if (!message) continue;

    const embed = EmbedBuilder.from(message.embeds[0]).setDescription(
      buildPanelDescription(panel.service, panel.products, config)
    );
    await message.edit({ embeds: [embed] });
    updatedCount++;
  }
  return updatedCount;
}

async function updateStatusChannels(guild, config) {
  const status = config.storeStatus || {};
  const names = {
    'STOCK VIA SEND': `💰 | STOCK VIA SEND: ${formatNumber(config.stockViaSend)}`,
    'STOCK RBX GIG': `💰 | STOCK RBX GIG: ${formatNumber(config.stockGift)}`,
    RATE: `🔒 | RATE: ${formatNumber(config.giftRate)}`,
    'GIFT GAMEPASS': `🎁 | GIFT GAMEPASS: ${status.gift !== false ? '✅' : '❌'}`,
    'INSTANT SEND': `⚡ | INSTANT SEND: ${status.send !== false ? '✅' : '❌'}`,
    'VIA LOGIN': `📦 | VIA LOGIN: ${status.login !== false ? '✅' : '❌'}`
  };

  const channels = await guild.channels.fetch();
  const statusChannels = channels.filter((channel) => channel?.parentId === STATUS_CATEGORY_ID);
  let updatedCount = 0;
  for (const channel of statusChannels.values()) {
    const channelLabel = channel.name.match(/\|\s*([^:]+):/)?.[1]?.trim().toUpperCase();
    const label = Object.keys(names).find((key) => channelLabel === key);
    if (!label || channel.name === names[label]) continue;
    try {
      await channel.setName(names[label], 'Sinkronisasi status dashboard toko');
      updatedCount++;
    } catch (error) {
      console.error(`❌ Gagal memperbarui status channel ${channel.id}:`, error.message);
    }
  }
  return updatedCount;
}

async function getConfig(guildId) {
  let config = await GuildConfig.findOne({ guildId });
  if (!config) {
    config = await GuildConfig.create({ guildId });
  }
  return config;
}

function buildDashboardPayload(config) {
  const status = config.storeStatus || {};
  const embed = new EmbedBuilder()
    .setColor(config.embedColor || process.env.EMBED_COLOR || '#FF8474')
    .setTitle('🍑 Athi Store — Store Dashboard')
    .setDescription(
      'Gunakan tombol di bawah untuk membuka/menutup layanan, mengubah stock/rate, dan memperbarui pricelist.'
    )
    .addFields(
      {
        name: '⚡ Robux Via Username / Send',
        value: `${statusLabel(status.send !== false)}\nStock: **${formatNumber(config.stockViaSend)}**`,
        inline: true
      },
      {
        name: '🔐 Robux Via Login',
        value: `${statusLabel(status.login !== false)}`,
        inline: true
      },
      {
        name: '🎁 Gift In Game',
        value: `${statusLabel(status.gift !== false)}\nStock: **${formatNumber(config.stockGift)}**\nRate: **Rp ${formatNumber(config.giftRate)} / Robux**`,
        inline: true
      }
    )
    .setFooter({ text: 'Athi Store • Dashboard otomatis diperbarui' })
    .setTimestamp();

  const rows = [
    new ActionRowBuilder().addComponents(
      createButton(
        'store_toggle_send',
        `${status.send !== false ? '🟢' : '🔴'} Send`,
        status.send !== false ? ButtonStyle.Success : ButtonStyle.Danger
      ),
      createButton(
        'store_toggle_login',
        `${status.login !== false ? '🟢' : '🔴'} Login`,
        status.login !== false ? ButtonStyle.Success : ButtonStyle.Danger
      ),
      createButton(
        'store_toggle_gift',
        `${status.gift !== false ? '🟢' : '🔴'} Gift`,
        status.gift !== false ? ButtonStyle.Success : ButtonStyle.Danger
      )
    ),
    new ActionRowBuilder().addComponents(
      createButton('store_stock_send', '📦 Stock Send', ButtonStyle.Primary),
      createButton('store_stock_gift', '📦 Stock Gift', ButtonStyle.Primary),
      createButton('store_rate_gift', '💰 Rate Gift', ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      createButton('store_price_send', '💸 Harga Send', ButtonStyle.Secondary),
      createButton('store_price_login', '💸 Harga Login', ButtonStyle.Secondary),
      createButton('store_refresh', '🔄 Refresh', ButtonStyle.Secondary)
    )
  ];

  return { embeds: [embed], components: rows };
}

async function updateDashboard(guild, config = null) {
  const resolvedConfig = config || (await getConfig(guild.id));
  const channel = guild.channels.cache.get(DASHBOARD_CHANNEL_ID);
  if (!channel?.isTextBased()) {
    throw new Error(`Channel dashboard ${DASHBOARD_CHANNEL_ID} tidak ditemukan atau bukan text channel.`);
  }

  let message = null;
  if (resolvedConfig.storeDashboardMessageId) {
    message = await channel.messages.fetch(resolvedConfig.storeDashboardMessageId).catch(() => null);
  }

  if (!message) {
    const recentMessages = await channel.messages.fetch({ limit: 50 });
    message = recentMessages.find(
      (item) => item.author.id === guild.client.user.id && item.embeds[0]?.title === '🍑 Athi Store — Store Dashboard'
    );
  }

  const payload = buildDashboardPayload(resolvedConfig);
  if (message) {
    await message.edit(payload);
  } else {
    message = await channel.send(payload);
  }

  resolvedConfig.storeDashboardChannelId = channel.id;
  resolvedConfig.storeDashboardMessageId = message.id;
  await resolvedConfig.save();
  const updatedStatusChannels = await updateStatusChannels(guild, resolvedConfig);
  const updatedOrderPanels = await updateOrderPanelEmbeds(guild, resolvedConfig);
  return { message, updatedStatusChannels, updatedOrderPanels };
}

async function setServiceStatus(guildId, service, isOpen) {
  if (!SERVICE_LABELS[service]) throw new Error(`Layanan ${service} tidak valid.`);
  const config = await getConfig(guildId);
  config.storeStatus[service] = isOpen;
  await config.save();
  return config;
}

async function setNumericValue(guildId, field, value) {
  const config = await getConfig(guildId);
  config[field] = value;
  await config.save();
  return config;
}

async function getServiceStatus(guildId, service) {
  const config = await GuildConfig.findOne({ guildId });
  return config?.storeStatus?.[service] !== false;
}

module.exports = {
  DASHBOARD_CHANNEL_ID,
  SERVICE_LABELS,
  buildDashboardPayload,
  getConfig,
  getServiceStatus,
  setNumericValue,
  setServiceStatus,
  updateDashboard,
  updateOrderPanelEmbeds
};
