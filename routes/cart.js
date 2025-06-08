const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get user's cart
router.get('/', requireAuth, async (req, res) => {
    try {
        const [cartItems] = await db.execute(
            `SELECT c.*, p.name, p.price, p.image, p.stock_quantity,
                    (c.quantity * p.price) as subtotal
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC`,
            [req.session.userId]
        );

        const total = cartItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

        res.json({
            items: cartItems,
            total: total.toFixed(2),
            count: cartItems.length
        });

    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add item to cart
router.post('/add', requireAuth, async (req, res) => {
    try {
        const { product_id, quantity = 1 } = req.body;

        if (!product_id) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        // Check if product exists and has stock
        const [products] = await db.execute(
            'SELECT * FROM products WHERE id = ? AND status = "active"',
            [product_id]
        );

        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = products[0];

        if (product.stock_quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        // Check if item already in cart
        const [existingItems] = await db.execute(
            'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
            [req.session.userId, product_id]
        );

        if (existingItems.length > 0) {
            // Update quantity
            const newQuantity = existingItems[0].quantity + parseInt(quantity);
            
            if (product.stock_quantity < newQuantity) {
                return res.status(400).json({ error: 'Insufficient stock for requested quantity' });
            }

            await db.execute(
                'UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
                [newQuantity, req.session.userId, product_id]
            );
        } else {
            // Add new item
            await db.execute(
                'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
                [req.session.userId, product_id, quantity]
            );
        }

        res.json({ message: 'Item added to cart successfully' });

    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update cart item quantity
router.put('/update/:id', requireAuth, async (req, res) => {
    try {
        const { quantity } = req.body;
        const cartItemId = req.params.id;

        if (!quantity || quantity < 1) {
            return res.status(400).json({ error: 'Valid quantity is required' });
        }

        // Check if cart item belongs to user
        const [cartItems] = await db.execute(
            'SELECT c.*, p.stock_quantity FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = ? AND c.user_id = ?',
            [cartItemId, req.session.userId]
        );

        if (cartItems.length === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        if (cartItems[0].stock_quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        await db.execute(
            'UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?',
            [quantity, cartItemId, req.session.userId]
        );

        res.json({ message: 'Cart updated successfully' });

    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove item from cart
router.delete('/remove/:id', requireAuth, async (req, res) => {
    try {
        const cartItemId = req.params.id;

        const [result] = await db.execute(
            'DELETE FROM cart WHERE id = ? AND user_id = ?',
            [cartItemId, req.session.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        res.json({ message: 'Item removed from cart successfully' });

    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Clear cart
router.delete('/clear', requireAuth, async (req, res) => {
    try {
        await db.execute(
            'DELETE FROM cart WHERE user_id = ?',
            [req.session.userId]
        );

        res.json({ message: 'Cart cleared successfully' });

    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;