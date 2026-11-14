const mongoose = require('mongoose');

/**
 * Schema Konfigurasi Server Discord (Guild)
 * Menyimpan pengaturan channel, role staff, tiket, dan pesan welcome/goodbye per server.
 */
const guildConfigSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    ticketCategoryId: {
      type: String,
      default: null
    },
    ticketLogChannelId: {
      type: String,
      default: null
    },
    staffRoleId: {
      type: String,
      default: null
    },
    orderLogChannelId: {
      type: String,
      default: null
    },
    welcomeChannelId: {
      type: String,
      default: null
    },
    welcomeMessage: {
      type: String,
      default: 'Selamat datang {user} di **{server}**! 🎉\nSilakan cek katalog produk kami di `/pricelist` atau hubungi staff jika ada pertanyaan.'
    },
    welcomeEnabled: {
      type: Boolean,
      default: false
    },
    goodbyeChannelId: {
      type: String,
      default: null
    },
    goodbyeMessage: {
      type: String,
      default: 'Sampai jumpa {user}! Terima kasih telah mampir di **{server}** 👋'
    },
    goodbyeEnabled: {
      type: Boolean,
      default: false
    },
    embedColor: {
      type: String,
      default: process.env.EMBED_COLOR || '#FF8474'
    },
    storeStatus: {
      send: { type: Boolean, default: true },
      login: { type: Boolean, default: true },
      gift: { type: Boolean, default: true }
    },
    stockViaSend: {
      type: Number,
      default: 0,
      min: 0
    },
    stockGift: {
      type: Number,
      default: 0,
      min: 0
    },
    giftRate: {
      type: Number,
      default: 95,
      min: 0
    },
    storeDashboardChannelId: {
      type: String,
      default: null
    },
    storeDashboardMessageId: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('GuildConfig', guildConfigSchema);

