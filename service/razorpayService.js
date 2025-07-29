 // services/razorpayService.js
import Razorpay from 'razorpay';
import crypto from 'crypto';

class RazorpayService {
    constructor() {
        this.razorpay = new Razorpay({
            key_id: "rzp_test_9g0VKosTAwrJRK",
            key_secret: "YbZw0IsfvLizXHvNz7N1J0lx"
        });
    }

    /**
     * Create a new order in Razorpay
     * @param {Object} orderData - Order details
     * @param {number} orderData.amount - Amount in rupees
     * @param {string} orderData.currency - Currency code (default: INR)
     * @param {string} orderData.receipt - Receipt number
     * @param {Object} orderData.notes - Additional notes
     * @returns {Promise<Object>} Razorpay order object
     */
    async createOrder(orderData) {
        try {
            const { amount, currency = 'INR', receipt, notes = {} } = orderData;
            const options = {
                amount: Math.round(amount * 100), // Convert to paise
                currency,
                receipt: receipt || `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                notes: {
                    order_type: 'online_purchase',
                    ...notes
                }
            };

            const order = await this.razorpay.orders.create(options);
            return {
                success: true,
                data: order
            };
        } catch (error) {
            console.error('Razorpay Order Creation Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify payment signature
     * @param {Object} paymentData - Payment verification data
     * @param {string} paymentData.razorpay_payment_id - Payment ID
     * @param {string} paymentData.razorpay_order_id - Order ID
     * @param {string} paymentData.razorpay_signature - Payment signature
     * @returns {Object} Verification result
     */
    verifyPaymentSignature(paymentData) {
        try {
            const {
                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            } = paymentData;
            if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                return {
                    success: false,
                    error: 'Missing required payment parameters'
                };
            }

            const body = razorpay_order_id + '|' + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', "YbZw0IsfvLizXHvNz7N1J0lx")
                .update(body.toString())
                .digest('hex');

            const isSignatureValid = expectedSignature === razorpay_signature;
            return {
                success: isSignatureValid,
                message: isSignatureValid ? 'Payment verified successfully' : 'Invalid payment signature'
            };
        } catch (error) {
            console.error('Payment Verification Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Fetch payment details by payment ID
     * @param {string} paymentId - Razorpay payment ID
     * @returns {Promise<Object>} Payment details
     */
    async getPaymentDetails(paymentId) {
        try {
            const payment = await this.razorpay.payments.fetch(paymentId);
            return {
                success: true,
                data: payment
            };
        } catch (error) {
            console.error('Fetch Payment Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Fetch order details by order ID
     * @param {string} orderId - Razorpay order ID
     * @returns {Promise<Object>} Order details
     */
    async getOrderDetails(orderId) {
        try {
            const order = await this.razorpay.orders.fetch(orderId);
            return {
                success: true,
                data: order
            };
        } catch (error) {
            console.error('Fetch Order Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create refund for a payment
     * @param {Object} refundData - Refund details
     * @param {string} refundData.paymentId - Payment ID to refund
     * @param {number} refundData.amount - Refund amount in rupees (optional, full refund if not provided)
     * @param {Object} refundData.notes - Additional notes
     * @returns {Promise<Object>} Refund details
     */
    async createRefund(refundData) {
        try {
            const { paymentId, amount, notes = {} } = refundData;

            const refundOptions = {
                notes
            };

            if (amount) {
                refundOptions.amount = Math.round(amount * 100); // Convert to paise
            }

            const refund = await this.razorpay.payments.refund(paymentId, refundOptions);
            return {
                success: true,
                data: refund
            };
        } catch (error) {
            console.error('Refund Creation Error:', error);
            return {
                success: false,
                error
            };
        }
    }
}

export default new RazorpayService();
