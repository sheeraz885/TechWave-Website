const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Dashboard stats
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        // Get various statistics
        const [userCount] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "user"');
        const [productCount] = await db.execute('SELECT COUNT(*) as count FROM products');
        const [orderCount] = await db.execute('SELECT COUNT(*) as count FROM orders');
        const [categoryCount] = await db.execute('SELECT COUNT(*) as count FROM categories');
        
        // Get recent orders
        const [recentOrders] = await db.execute(
            `SELECT o.*, u.username, u.email 
             FROM orders o 
             JOIN users u ON o.user_id = u.id 
             ORDER BY o.created_at DESC 
             LIMIT 10`
        );

        // Get low stock products
        const [lowStockProducts] = await db.execute(
            'SELECT * FROM products WHERE stock_quantity < 10 ORDER BY stock_quantity ASC LIMIT 10'
        );

        res.json({
            stats: {
                users: userCount[0].count,
                products: productCount[0].count,
                orders: orderCount[0].count,
                categories: categoryCount[0].count
            },
            recentOrders,
            lowStockProducts
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Products Management
router.get('/products', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, category } = req.query;
        
        let query = `
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
        `;
        const params = [];

        if (search) {
            query += ' WHERE (p.name LIKE ? OR p.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            query += search ? ' AND' : ' WHERE';
            query += ' p.category_id = ?';
            params.push(category);
        }

        query += ' ORDER BY p.created_at DESC';

        const offset = (page - 1) * limit;
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [products] = await db.execute(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM products p';
        const countParams = [];

        if (search) {
            countQuery += ' WHERE (p.name LIKE ? OR p.description LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            countQuery += search ? ' AND' : ' WHERE';
            countQuery += ' p.category_id = ?';
            countParams.push(category);
        }

        const [countResult] = await db.execute(countQuery, countParams);

        res.json({
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Get admin products error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add product
router.post('/products', requireAdmin, upload.single('image'), [
    body('name').notEmpty().withMessage('Product name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stock_quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, price, category_id, stock_quantity, featured, status } = req.body;
        const image = req.file ? req.file.filename : null;

        const [result] = await db.execute(
            'INSERT INTO products (name, description, price, category_id, stock_quantity, image, featured, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, description || null, price, category_id || null, stock_quantity || 0, image, featured === 'true', status || 'active']
        );

        res.status(201).json({
            message: 'Product created successfully',
            product_id: result.insertId
        });

    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update product
router.put('/products/:id', requireAdmin, upload.single('image'), [
    body('name').notEmpty().withMessage('Product name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stock_quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, price, category_id, stock_quantity, featured, status } = req.body;
        const productId = req.params.id;

        let query = 'UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, stock_quantity = ?, featured = ?, status = ?';
        let params = [name, description || null, price, category_id || null, stock_quantity || 0, featured === 'true', status || 'active'];

        if (req.file) {
            query += ', image = ?';
            params.push(req.file.filename);
        }

        query += ' WHERE id = ?';
        params.push(productId);

        const [result] = await db.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product updated successfully' });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete product
router.delete('/products/:id', requireAdmin, async (req, res) => {
    try {
        const [result] = await db.execute(
            'DELETE FROM products WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully' });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Categories Management
router.get('/categories', requireAdmin, async (req, res) => {
    try {
        const [categories] = await db.execute(
            'SELECT c.*, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON c.id = p.category_id GROUP BY c.id ORDER BY c.name ASC'
        );

        res.json(categories);

    } catch (error) {
        console.error('Get admin categories error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add category
router.post('/categories', requireAdmin, upload.single('image'), [
    body('name').notEmpty().withMessage('Category name is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description } = req.body;
        const image = req.file ? req.file.filename : null;

        const [result] = await db.execute(
            'INSERT INTO categories (name, description, image) VALUES (?, ?, ?)',
            [name, description || null, image]
        );

        res.status(201).json({
            message: 'Category created successfully',
            category_id: result.insertId
        });

    } catch (error) {
        console.error('Add category error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update category
router.put('/categories/:id', requireAdmin, upload.single('image'), [
    body('name').notEmpty().withMessage('Category name is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description } = req.body;
        const categoryId = req.params.id;

        let query = 'UPDATE categories SET name = ?, description = ?';
        let params = [name, description || null];

        if (req.file) {
            query += ', image = ?';
            params.push(req.file.filename);
        }

        query += ' WHERE id = ?';
        params.push(categoryId);

        const [result] = await db.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category updated successfully' });

    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete category
router.delete('/categories/:id', requireAdmin, async (req, res) => {
    try {
        // Check if category has products
        const [products] = await db.execute(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
            [req.params.id]
        );

        if (products[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete category with existing products' });
        }

        const [result] = await db.execute(
            'DELETE FROM categories WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully' });

    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Orders Management
router.get('/orders', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        let query = `
            SELECT o.*, u.username, u.email, u.full_name,
                   COUNT(oi.id) as item_count
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
        `;
        const params = [];

        if (status) {
            query += ' WHERE o.status = ?';
            params.push(status);
        }

        query += ' GROUP BY o.id ORDER BY o.created_at DESC';

        const offset = (page - 1) * limit;
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [orders] = await db.execute(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM orders o';
        const countParams = [];

        if (status) {
            countQuery += ' WHERE o.status = ?';
            countParams.push(status);
        }

        const [countResult] = await db.execute(countQuery, countParams);

        res.json({
            orders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Get admin orders error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update order status
router.put('/orders/:id/status', requireAdmin, [
    body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { status } = req.body;
        const orderId = req.params.id;

        const [result] = await db.execute(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, orderId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ message: 'Order status updated successfully' });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get order details
router.get('/orders/:id', requireAdmin, async (req, res) => {
    try {
        const [orders] = await db.execute(
            `SELECT o.*, u.username, u.email, u.full_name, u.phone
             FROM orders o
             JOIN users u ON o.user_id = u.id
             WHERE o.id = ?`,
            [req.params.id]
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
        console.error('Get admin order error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Users Management
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        
        let query = 'SELECT id, username, email, full_name, phone, role, created_at FROM users';
        const params = [];

        if (search) {
            query += ' WHERE (username LIKE ? OR email LIKE ? OR full_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';

        const offset = (page - 1) * limit;
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [users] = await db.execute(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM users';
        const countParams = [];

        if (search) {
            countQuery += ' WHERE (username LIKE ? OR email LIKE ? OR full_name LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const [countResult] = await db.execute(countQuery, countParams);

        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Get admin users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;