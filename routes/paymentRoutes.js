// routes/paymentRoutes.js
import express from 'express';
import paymentController from '../controller/paymentController.js';
const router = express.Router();

// Create new payment order
router.post('/create-order', paymentController.createOrder);

// Verify payment
router.post('/verify-payment', paymentController.verifyPayment);

// Get payment details
router.get('/payment/:paymentId', paymentController.getPaymentDetails);

// Get order details
router.get('/order/:orderId', paymentController.getOrderDetails);

// Create refund
router.post('/refund', paymentController.createRefund);

// Webhook endpoint
router.post('/webhook', paymentController.handleWebhook);

export default router;
