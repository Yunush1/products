import { Product, Order } from './models';

// GST on commission and TCS rates (could be configurable per region)
const COMMISSION_GST_RATE = 0.18; // 18% GST on commission for example
const TCS_RATE = 0.01;            // 1% TCS on net supply value

async function processPayment(userId, productId) {
  // Fetch product details
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');

  // Calculate GST on product price
  const productGstValue = product.price * product.gstRate;

  // Calculate total price paid by buyer (price + GST)
  const totalPricePaid = product.price + productGstValue;

  // Calculate admin commission on total price (including GST)
  const adminCommission = totalPricePaid * product.commissionRate;

  // GST on commission
  const commissionGst = adminCommission * COMMISSION_GST_RATE;

  // Net commission charged to supplier (commission + gst on commission)
  const totalCommission = adminCommission + commissionGst;

  // Calculate TCS on net supply amount (price - commission)
  // As per Indian tax rules, TCS is 1% on net value of goods supplied to buyer
  // Net supply here could be product price minus commission or full product price depending on business policy
  const netSupply = product.price - adminCommission; 
  const tcs = netSupply * TCS_RATE;

  // Owner payout = Total price paid - commission - GST on commission - TCS
  const ownerPayout = totalPricePaid - totalCommission - tcs;

  // Create the order record
  const order = new Order({
    userId,
    productId,
    pricePaid: totalPricePaid,
    adminCommission,
    commissionGst,
    ownerPayout,
    tcs
  });

  await order.save();

  return order;
}

module.exports = { processPayment };