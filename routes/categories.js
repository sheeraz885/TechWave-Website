const express = require('express');
const db = require('../config/database');

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
    try {
        const [categories] = await db.execute(
            'SELECT * FROM categories ORDER BY name ASC'
        );

        res.json(categories);

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single category with products
router.get('/:id', async (req, res) => {
    try {
        const [categories] = await db.execute(
            'SELECT * FROM categories WHERE id = ?',
            [req.params.id]
        );

        if (categories.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const [products] = await db.execute(
            'SELECT * FROM products WHERE category_id = ? AND status = "active" ORDER BY name ASC',
            [req.params.id]
        );

        res.json({
            category: categories[0],
            products
        });

    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;