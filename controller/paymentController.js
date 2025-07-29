// controllers/paymentController.js
import razorpayService from '../service/razorpayService.js';

class PaymentController {
    /**
     * Create a new payment order
     */
    async createOrder(req, res) {
        try {
            const { amount, currency, receipt, notes, customerInfo } = req.body;

            // Validate required fields
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount is required'
                });
            }

            const orderData = {
                amount,
                currency,
                receipt,
                notes: {
                    ...notes,
                    customer_email: customerInfo?.email,
                    customer_phone: customerInfo?.phone,
                    customer_name: customerInfo?.name
                }
            };

            const result = await razorpayService.createOrder(orderData);
            if (result.success) {
                res.status(200).json({
                    success: true,
                    order: result.data,
                    key_id: "rzp_test_9g0VKosTAwrJRK"
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Create Order Controller Error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Verify payment signature
     */
    async verifyPayment(req, res) {
        try {
            const paymentData = req.body;

            const verificationResult = razorpayService.verifyPaymentSignature(paymentData);

            if (verificationResult.success) {
                // TODO: Save payment details to database
                // TODO: Update order status
                // TODO: Send confirmation email
                // TODO: Trigger any post-payment processes

                res.status(200).json({
                    success: true,
                    message: verificationResult.message,
                    payment_id: paymentData.razorpay_payment_id
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: verificationResult.error || verificationResult.message
                });
            }
        } catch (error) {
            console.error('Verify Payment Controller Error:', error);
            res.status(500).json({
                success: false,
                error: 'Payment verification failed'
            });
        }
    }

    /**
     * Get payment details
     */
    async getPaymentDetails(req, res) {
        try {
            const { paymentId } = req.params;

            if (!paymentId) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment ID is required'
                });
            }

            const result = await razorpayService.getPaymentDetails(paymentId);

            if (result.success) {
                res.status(200).json({
                    success: true,
                    payment: result.data
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Get Payment Details Controller Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch payment details'
            });
        }
    }

    /**
     * Get order details
     */
    async getOrderDetails(req, res) {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    error: 'Order ID is required'
                });
            }

            const result = await razorpayService.getOrderDetails(orderId);

            if (result.success) {
                res.status(200).json({
                    success: true,
                    order: result.data
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Get Order Details Controller Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch order details'
            });
        }
    }

    /**
     * Create refund
     */
    async createRefund(req, res) {
        try {
            const { paymentId, amount, reason, notes } = req.body;

            if (!paymentId) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment ID is required'
                });
            }

            const refundData = {
                paymentId,
                amount,
                notes: {
                    reason,
                    ...notes
                }
            };

            const result = await razorpayService.createRefund(refundData);

            if (result.success) {
                // TODO: Update order status in database
                // TODO: Send refund confirmation email

                res.status(200).json({
                    success: true,
                    refund: result.data
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Create Refund Controller Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process refund'
            });
        }
    }

    /**
     * Handle webhook from Razorpay
     */
    async handleWebhook(req, res) {
        try {
            const webhookSignature = req.headers['x-razorpay-signature'];
            const webhookBody = JSON.stringify(req.body);

            // Verify webhook signature
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
                .update(webhookBody)
                .digest('hex');

            if (webhookSignature !== expectedSignature) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid webhook signature'
                });
            }

            const event = req.body;

            // Handle different webhook events
            switch (event.event) {
                case 'payment.captured':
                    // Handle successful payment
                    console.log('Payment captured:', event.payload.payment.entity);
                    break;

                case 'payment.failed':
                    // Handle failed payment
                    console.log('Payment failed:', event.payload.payment.entity);
                    break;

                case 'order.paid':
                    // Handle order completion
                    console.log('Order paid:', event.payload.order.entity);
                    break;

                case 'refund.created':
                    // Handle refund creation
                    console.log('Refund created:', event.payload.refund.entity);
                    break;

                default:
                    console.log('Unhandled webhook event:', event.event);
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Webhook Handler Error:', error);
            res.status(500).json({
                success: false,
                error: 'Webhook processing failed'
            });
        }
    }
}

export default new PaymentController();
