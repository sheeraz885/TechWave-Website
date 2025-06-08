const db = require('../config/database');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

const requireAdmin = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const [users] = await db.execute(
            'SELECT role FROM users WHERE id = ?',
            [req.session.userId]
        );

        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getCurrentUser = async (req, res, next) => {
    if (req.session.userId) {
        try {
            const [users] = await db.execute(
                'SELECT id, username, email, full_name, role FROM users WHERE id = ?',
                [req.session.userId]
            );
            
            if (users.length > 0) {
                req.user = users[0];
            }
        } catch (error) {
            console.error('Get current user error:', error);
        }
    }
    next();
};

module.exports = {
    requireAuth,
    requireAdmin,
    getCurrentUser
};