const mongoose = require('mongoose');

/**
 * Schema Tiket Support & Order Athi Store
 * Mencatat channel tiket privat, kategori, staf yang mengklaim, serta log penutupan tiket.
 */
const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    channelId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    guildId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    userTag: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      enum: ['Support', 'Order', 'Report', 'Robux Via Send', 'Robux Via Login', 'Gift In Game'],
      default: 'Support'
    },
    isSuccess: {
      type: Boolean,
      default: false
    },
    orderNominal: {
      type: String,
      default: '-'
    },
    orderPrice: {
      type: String,
      default: '-'
    },
    robuxAmount: {
      type: Number,
      default: null
    },
    gameName: {
      type: String,
      default: null
    },
    gamepassType: {
      type: String,
      default: null
    },
    paymentMethod: {
      type: String,
      default: '-'
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLAIMED', 'CLOSED'],
      default: 'OPEN',
      index: true
    },
    claimedBy: {
      type: String,
      default: null
    },
    claimedByName: {
      type: String,
      default: null
    },
    closedBy: {
      type: String,
      default: null
    },
    closedByName: {
      type: String,
      default: null
    },
    closeReason: {
      type: String,
      default: 'Selesai dihandle'
    },
    closedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Ticket', ticketSchema);
