const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    let connection;
    
    try {
        // Connect to MySQL server (without database)
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        console.log('Connected to MySQL server');

        // Create database if it doesn't exist
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'techwave_ecommerce'}`);
        console.log('Database created or already exists');

        // Use the database
        await connection.execute(`USE ${process.env.DB_NAME || 'techwave_ecommerce'}`);

        // Create tables
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                address TEXT,
                role ENUM('user', 'admin') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,

            // Categories table
            `CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,

            // Products table
            `CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                category_id INT,
                stock_quantity INT DEFAULT 0,
                image VARCHAR(255),
                featured BOOLEAN DEFAULT FALSE,
                status ENUM('active', 'inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            )`,

            // Cart table
            `CREATE TABLE IF NOT EXISTS cart (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_product (user_id, product_id)
            )`,

            // Orders table
            `CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                total_amount DECIMAL(10, 2) NOT NULL,
                status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
                shipping_address TEXT NOT NULL,
                payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
                payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            // Order items table
            `CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )`
        ];

        for (const table of tables) {
            await connection.execute(table);
        }

        console.log('All tables created successfully');

        // Insert default admin user
        const adminExists = await connection.execute(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            ['admin@techwave.com', 'admin']
        );

        if (adminExists[0].length === 0) {
            await connection.execute(
                'INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
                ['admin', 'admin@techwave.com', 'admin123', 'System Administrator', 'admin']
            );
            console.log('Default admin user created (username: admin, password: admin123)');
        }

        // Insert default categories
        const categoriesData = [
            ['Speakers & Headphones', 'Audio devices and accessories', 'speakers.jpg'],
            ['Smartphones & Watches', 'Mobile devices and wearables', 'phones.jpg'],
            ['Home Appliances', 'Smart home devices and appliances', 'appliances.jpg'],
            ['Accessories', 'Tech accessories and gadgets', 'accessories.jpg']
        ];

        for (const category of categoriesData) {
            const exists = await connection.execute(
                'SELECT id FROM categories WHERE name = ?',
                [category[0]]
            );
            
            if (exists[0].length === 0) {
                await connection.execute(
                    'INSERT INTO categories (name, description, image) VALUES (?, ?, ?)',
                    category
                );
            }
        }

        console.log('Default categories created');

        // Insert sample products
        const productsData = [
            ['360 Mini Portable Speaker', 'Compact wireless speaker with 360-degree sound', 100.00, 1, 50, '1.jpg', true],
            ['Turn5 Portable Bluetooth Speaker With Handle', 'Powerful portable speaker with carrying handle', 160.00, 1, 30, '2.jpg', true],
            ['OVE Light Space 5G Smartphone, 128GB', 'Latest 5G smartphone with advanced features', 750.00, 2, 25, '3.jpg', true],
            ['Space Buds True Wireless Earbud Headphones', 'Premium wireless earbuds with noise cancellation', 150.00, 1, 40, '4.jpg', true]
        ];

        for (const product of productsData) {
            const exists = await connection.execute(
                'SELECT id FROM products WHERE name = ?',
                [product[0]]
            );
            
            if (exists[0].length === 0) {
                await connection.execute(
                    'INSERT INTO products (name, description, price, category_id, stock_quantity, image, featured) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    product
                );
            }
        }

        console.log('Sample products created');
        console.log('Database setup completed successfully!');

    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

setupDatabase();