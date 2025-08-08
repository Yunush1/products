const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
  name: String,
  price: Number, // base price without GST
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  commissionRate: Number, // e.g., 0.10 for 10%
  gstRate: Number // e.g., 0.05 for 5% GST on product price
});

const orderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  pricePaid: Number,          // total including GST
  adminCommission: Number,
  commissionGst: Number,      // GST on commission
  ownerPayout: Number,
  tcs: Number,                // Tax Collected at Source (1% of net supply)
  paymentDate: { type: Date, default: Date.now }
});

const userSchema = new Schema({
  name: String,
  email: String,
  role: String,
  permissions: [String],
  isBlocked: Boolean
});

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const User = mongoose.model('User', userSchema);

module.exports = { Product, Order, User };
