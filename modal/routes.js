import express from 'express';

const productRouter = express.Router();
productRouter.post('/pay', async (req, res) => {
  try {
    const { userId, productId } = req.body;

    const order = await processPayment(userId, productId);

    res.status(201).json({
      message: 'Payment processed successfully',
      order
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = productRouter;
