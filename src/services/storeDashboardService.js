const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

const DASHBOARD_CHANNEL_ID = '1571074377842298920';
const STATUS_CATEGORY_ID = process.env.STATUS_CATEGORY_ID || '1570115256334950440';
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
  return { message, updatedStatusChannels };
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
  updateDashboard
};
