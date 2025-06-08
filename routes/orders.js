const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Create order from cart
router.post('/create', requireAuth, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const { shipping_address, payment_method = 'cash_on_delivery', notes } = req.body;

        if (!shipping_address) {
            return res.status(400).json({ error: 'Shipping address is required' });
        }

        // Get cart items
        const [cartItems] = await connection.execute(
            `SELECT c.*, p.name, p.price, p.stock_quantity
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = ?`,
            [req.session.userId]
        );

        if (cartItems.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // Check stock availability
        for (const item of cartItems) {
            if (item.stock_quantity < item.quantity) {
                await connection.rollback();
                return res.status(400).json({ 
                    error: `Insufficient stock for ${item.name}. Available: ${item.stock_quantity}, Requested: ${item.quantity}` 
                });
            }
        }

        // Calculate total
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Create order
        const [orderResult] = await connection.execute(
            'INSERT INTO orders (user_id, total_amount, shipping_address, payment_method, notes) VALUES (?, ?, ?, ?, ?)',
            [req.session.userId, total, shipping_address, payment_method, notes || null]
        );

        const orderId = orderResult.insertId;

        // Create order items and update stock
        for (const item of cartItems) {
            // Add order item
            await connection.execute(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, item.product_id, item.quantity, item.price]
            );

            // Update product stock
            await connection.execute(
                'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        // Clear cart
        await connection.execute(
            'DELETE FROM cart WHERE user_id = ?',
            [req.session.userId]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Order created successfully',
            order_id: orderId,
            total: total.toFixed(2)
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        connection.release();
    }
});

// Get user's orders
router.get('/my-orders', requireAuth, async (req, res) => {
    try {
        const [orders] = await db.execute(
            `SELECT o.*, 
                    COUNT(oi.id) as item_count
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.user_id = ?
             GROUP BY o.id
             ORDER BY o.created_at DESC`,
            [req.session.userId]
        );

        res.json(orders);

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single order details
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const [orders] = await db.execute(
            'SELECT * FROM orders WHERE id = ? AND user_id = ?',
            [req.params.id, req.session.userId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const [orderItems] = await db.execute(
            `SELECT oi.*, p.name, p.image
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [req.params.id]
        );

        res.json({
            order: orders[0],
            items: orderItems
        });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;