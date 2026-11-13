const mongoose = require('mongoose');

/**
 * Schema Pesanan (Order) Athi Store
 * Mencatat pesanan Robux yang diajukan oleh user beserta status transaksi.
 */
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    userTag: {
      type: String,
      required: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    productName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    totalPrice: {
      type: Number,
      required: true
    },
    robloxUsername: {
      type: String,
      required: true
    },
    contactInfo: {
      type: String,
      default: '-'
    },
    notes: {
      type: String,
      default: '-'
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },
    handledBy: {
      type: String,
      default: null
    },
    handledByName: {
      type: String,
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Order', orderSchema);

