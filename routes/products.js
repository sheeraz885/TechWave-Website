const express = require('express');
const db = require('../config/database');
const { getCurrentUser } = require('../middleware/auth');

const router = express.Router();

// Get all products with filtering and search
router.get('/', async (req, res) => {
    try {
        const { 
            search, 
            category, 
            min_price, 
            max_price, 
            featured, 
            sort = 'created_at', 
            order = 'DESC',
            page = 1,
            limit = 12
        } = req.query;

        let query = `
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.status = 'active'
        `;
        const params = [];

        // Search filter
        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Category filter
        if (category) {
            query += ' AND p.category_id = ?';
            params.push(category);
        }

        // Price filters
        if (min_price) {
            query += ' AND p.price >= ?';
            params.push(min_price);
        }

        if (max_price) {
            query += ' AND p.price <= ?';
            params.push(max_price);
        }

        // Featured filter
        if (featured === 'true') {
            query += ' AND p.featured = 1';
        }

        // Sorting
        const validSortFields = ['name', 'price', 'created_at'];
        const validOrders = ['ASC', 'DESC'];
        
        if (validSortFields.includes(sort) && validOrders.includes(order.toUpperCase())) {
            query += ` ORDER BY p.${sort} ${order.toUpperCase()}`;
        }

        // Pagination
        const offset = (page - 1) * limit;
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [products] = await db.execute(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM products p WHERE p.status = "active"';
        const countParams = [];

        if (search) {
            countQuery += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            countQuery += ' AND p.category_id = ?';
            countParams.push(category);
        }

        if (min_price) {
            countQuery += ' AND p.price >= ?';
            countParams.push(min_price);
        }

        if (max_price) {
            countQuery += ' AND p.price <= ?';
            countParams.push(max_price);
        }

        if (featured === 'true') {
            countQuery += ' AND p.featured = 1';
        }

        const [countResult] = await db.execute(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const [products] = await db.execute(
            `SELECT p.*, c.name as category_name 
             FROM products p 
             LEFT JOIN categories c ON p.category_id = c.id 
             WHERE p.id = ? AND p.status = 'active'`,
            [req.params.id]
        );

        if (products.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(products[0]);

    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get featured products
router.get('/featured/list', async (req, res) => {
    try {
        const [products] = await db.execute(
            `SELECT p.*, c.name as category_name 
             FROM products p 
             LEFT JOIN categories c ON p.category_id = c.id 
             WHERE p.featured = 1 AND p.status = 'active' 
             ORDER BY p.created_at DESC 
             LIMIT 8`
        );

        res.json(products);

    } catch (error) {
        console.error('Get featured products error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;