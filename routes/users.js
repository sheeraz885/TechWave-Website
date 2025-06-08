const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, username, email, full_name, phone, address, created_at FROM users WHERE id = ?',
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users[0]);

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user profile
router.put('/profile', requireAuth, [
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { full_name, email, phone, address } = req.body;

        // Check if email is already taken by another user
        const [existingUsers] = await db.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, req.session.userId]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Email is already taken' });
        }

        await db.execute(
            'UPDATE users SET full_name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
            [full_name, email, phone || null, address || null, req.session.userId]
        );

        res.json({ message: 'Profile updated successfully' });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change password
router.put('/change-password', requireAuth, [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { current_password, new_password } = req.body;

        // Get current user
        const [users] = await db.execute(
            'SELECT password FROM users WHERE id = ?',
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        if (users[0].password !== current_password) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Update password
        await db.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [new_password, req.session.userId]
        );

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;