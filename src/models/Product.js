const mongoose = require('mongoose');

/**
 * Schema Produk Toko Athi Store
 * Menyimpan daftar paket Robux (Via Username, Vilog, dll) beserta harga dan ketentuannya.
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: ['ROBUX VIA USERNAME', 'ROBUX VILOG'],
      index: true
    },
    price: {
      type: Number,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      default: 'Robux'
    },
    description: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Product', productSchema);

