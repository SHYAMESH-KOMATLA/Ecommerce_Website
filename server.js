const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

// Database connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'raash_db'
};

const db = mysql.createConnection(dbConfig);

// Test database connection
db.connect((err) => {
    if (err) {
        console.error('MySQL connection error:', {
            code: err.code,
            message: err.message,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage
        });
        process.exit(1);
    }
    console.log('Connected to MySQL database');
    db.query('SHOW TABLES LIKE ?', ['users'], (err, results) => {
        if (err) {
            console.error('Error checking users table:', err);
        } else if (results.length === 0) {
            console.error('users table does not exist in raash_db');
        } else {
            console.log('users table verified');
        }
    });
});

const sessionStore = new MySQLStore(dbConfig);

app.use(session({
    name: process.env.SESSION_NAME || 'raash.sid',
    secret: process.env.SESSION_SECRET || 'bac7193f27bd81021a762700fd7e3f7acb889fc47aad03ae36ce796ff409e016',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 1000 * 60 * 60 * 24,
        domain: process.env.COOKIE_DOMAIN || 'localhost',
        sameSite: 'lax'
    }
}));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'raashbusiness69@gmail.com',
        pass: process.env.EMAIL_PASS || 'gpmujrbvtbdlxdos'
    },
    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('Email configuration error:', error.message);
    } else {
        console.log('Email server is ready to send messages');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'homepage.html'));
});

app.get('/api/products', (req, res) => {
    const id = req.query.id;
    const search = req.query.search;
    let query = 'SELECT * FROM products';
    const params = [];

    if (id) {
        query += ' WHERE id = ?';
        params.push(id);
    } else if (search) {
        query += ' WHERE name LIKE ?';
        params.push(`%${search}%`);
    }

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Database error fetching products:', {
                code: err.code,
                message: err.message,
                sqlState: err.sqlState
            });
            return res.status(500).json({ error: 'Database error', details: err.message });
        }
        res.json(results || []);
    });
});

app.get('/api/products/category/:category', (req, res) => {
    const category = req.params.category;
    db.query('SELECT * FROM products WHERE category = ?', [category], (err, results) => {
        if (err) {
            console.error(`Database error fetching products for category ${category}:`, {
                code: err.code,
                message: err.message,
                sqlState: err.sqlState
            });
            return res.status(500).json({ error: 'Database error', details: err.message });
        }
        res.json(results || []);
    });
});

app.get('/api/cart', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    
    db.query(`
        SELECT c.product_id, p.name, p.price, p.image_path, p.description, c.quantity
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?`, 
        [req.session.user.user_id], 
        (err, results) => {
            if (err) {
                console.error('Database error fetching cart:', {
                    code: err.code,
                    message: err.message,
                    sqlState: err.sqlState
                });
                return res.status(500).json({ error: 'Database error', details: err.message });
            }
            res.json(results || []);
        }
    );
});

app.post('/api/cart/update', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Please login to add items to cart' });
    }
    
    const { product_id, action } = req.body;
    const user_id = req.session.user.user_id;

    if (!product_id || !['increase', 'decrease'].includes(action)) {
        return res.status(400).json({ error: 'Invalid request parameters' });
    }

    db.query('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', [user_id, product_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err.message });
        
        if (results.length === 0 && action === 'increase') {
            db.query('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, 1)', 
                [user_id, product_id], 
                (err) => {
                    if (err) return res.status(500).json({ error: 'Database error', details: err.message });
                    res.json({ success: true });
                });
        } else if (results.length > 0) {
            const currentQuantity = results[0].quantity;
            if (action === 'increase') {
                db.query('UPDATE cart SET quantity = quantity + 1 WHERE user_id = ? AND product_id = ?', 
                    [user_id, product_id], (err) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        res.json({ success: true });
                    });
            } else if (action === 'decrease' && currentQuantity > 1) {
                db.query('UPDATE cart SET quantity = quantity - 1 WHERE user_id = ? AND product_id = ?', 
                    [user_id, product_id], (err) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        res.json({ success: true });
                    });
            } else if (action === 'decrease' && currentQuantity === 1) {
                db.query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', 
                    [user_id, product_id], (err) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        res.json({ success: true });
                    });
            }
        } else {
            res.json({ success: false, message: 'No action taken' });
        }
    });
});

app.post('/api/orders', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    
    const user_id = req.session.user.user_id;
    const order_id = 'ORD' + Math.floor(100000 + Math.random() * 900000).toString();
    db.query('INSERT INTO orders (order_id, user_id, subtotal, shipping, total, payment_method, address, status, created_at) SELECT ?, ?, SUM(p.price * c.quantity), 100.00, SUM(p.price * c.quantity) + 100.00, ?, ?, ?, NOW() FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?', 
        [order_id, user_id, 'cash-on-delivery', 'Pending', 'Pending', user_id], (err, result) => {
            if (err) {
                console.error('Database error creating order:', {
                    code: err.code,
                    message: err.message,
                    sqlState: err.sqlState
                });
                return res.status(500).json({ error: 'Database error', details: err.message });
            }
            
            const orderId = result.insertId;
            db.query('SELECT product_id, quantity FROM cart WHERE user_id = ?', [user_id], (err, cartItems) => {
                if (err) {
                    console.error('Error fetching cart items:', err.message);
                    return res.status(500).json({ error: 'Database error', details: err.message });
                }
                const insertOrderItems = cartItems.map(item => [
                    orderId,
                    item.product_id,
                    item.quantity,
                    (function() {
                        db.query('SELECT price FROM products WHERE id = ?', [item.product_id], (err, results) => {
                            if (err || !results[0]) return 0;
                            return results[0].price;
                        });
                    })()
                ]);
                db.query('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?', [insertOrderItems], (err) => {
                    if (err) console.error('Error inserting order items:', err.message);
                });
                db.query('INSERT INTO payments (order_id, user_id, amount, payment_method, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                    [orderId, user_id, 100.00 + cartItems.reduce((sum, item) => sum + item.quantity * (db.query('SELECT price FROM products WHERE id = ?', [item.product_id], (err, results) => results[0]?.price || 0)), 0), 'cash-on-delivery', 'Pending', 'Pending'], (err) => {
                        if (err) console.error('Error inserting payment:', err.message);
                    });
                db.query('DELETE FROM cart WHERE user_id = ?', [user_id], (err) => {
                    if (err) console.error('Error clearing cart:', err.message);
                });
                res.json({ success: true, orderId });
            });
        });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ 
            authenticated: true, 
            user_type: req.session.user.user_type,
            user_id: req.session.user.user_id,
            email: req.session.user.email,
            full_name: req.session.user.full_name
        });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', {
                code: err.code,
                message: err.message,
                sqlState: err.sqlState
            });
            return res.status(500).json({ error: 'Logout failed', details: err.message });
        }
        res.clearCookie(process.env.SESSION_NAME);
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

app.post('/register', async (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({ error: 'All fields (full_name, email, password) are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Database error checking email:', {
                code: err.code,
                message: err.message,
                sqlState: err.sqlState
            });
            return res.status(500).json({ error: 'Database error', details: err.message });
        }
        if (results.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                console.error('Error hashing password:', err.message);
                return res.status(500).json({ error: 'Internal server error', details: err.message });
            }

            db.query(
                'INSERT INTO users (full_name, email, password_hash, user_type, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                [full_name, email, hash, 'customer'],
                (err, result) => {
                    if (err) {
                        console.error('Database error registering user:', {
                            code: err.code,
                            message: err.message,
                            sqlState: err.sqlState,
                            sql: err.sql
                        });
                        return res.status(500).json({ error: 'Database error', details: err.message });
                    }
                    res.json({ message: 'Registration successful', redirect: '/login.html' });
                }
            );
        });
    });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        db.query('SELECT id, full_name, email, password_hash, user_type FROM users WHERE email = ?', [email], (err, results) => {
            if (err) {
                console.error('Database error checking user:', {
                    code: err.code,
                    message: err.message,
                    sqlState: err.sqlState
                });
                return res.status(500).json({ error: 'Database error', details: err.message });
            }
            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const user = results[0];
            bcrypt.compare(password, user.password_hash, (err, match) => {
                if (err) {
                    console.error('Error comparing passwords:', err.message);
                    return res.status(500).json({ error: 'Internal server error', details: err.message });
                }
                if (!match) {
                    return res.status(401).json({ error: 'Invalid email or password' });
                }

                req.session.user = { 
                    user_id: user.id, 
                    email: user.email, 
                    full_name: user.full_name, 
                    user_type: user.user_type 
                };
                req.session.save((err) => {
                    if (err) {
                        console.error('Session save error:', err.message);
                        return res.status(500).json({ error: 'Session error', details: err.message });
                    }
                    res.json({ message: 'Login successful', redirect: '/homepage.html' });
                });
            });
        });
    } catch (error) {
        console.error('Unexpected error in login:', error);
        res.status(500).json({ error: 'Unexpected error', details: error.message });
    }
});

app.post('/api/payments', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

    const { products, subtotal, shipping, total, payment_method, address } = req.body;
    const user_id = req.session.user.user_id;
    const order_id = 'ORD' + Math.floor(100000 + Math.random() * 900000).toString();

    db.beginTransaction((err) => {
        if (err) {
            console.error('Transaction error:', err.message);
            return res.status(500).json({ error: 'Transaction failed', details: err.message });
        }

        db.query(
            'INSERT INTO orders (order_id, user_id, subtotal, shipping, total, payment_method, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [order_id, user_id, subtotal, shipping, total, payment_method, address, 'Pending'],
            (err, result) => {
                if (err) {
                    console.error('Error inserting order:', err.message);
                    return db.rollback(() => res.status(500).json({ error: 'Database error', details: err.message }));
                }

                const orderId = result.insertId; // Auto-incremented ID from orders table
                const orderItems = products.map(p => [orderId, p.product_id || p.id, p.quantity, p.price]);
                db.query('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?', [orderItems], (err) => {
                    if (err) {
                        console.error('Error inserting order items:', err.message);
                        return db.rollback(() => res.status(500).json({ error: 'Database error', details: err.message }));
                    }

                    db.query(
                        'INSERT INTO payments (order_id, user_id, amount, payment_method, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                        [orderId, user_id, total, payment_method, address, 'Pending'],
                        (err) => {
                            if (err) {
                                console.error('Error inserting payment:', err.message);
                                return db.rollback(() => res.status(500).json({ error: 'Database error', details: err.message }));
                            }

                            const receiptText = `
Thank you for your order!
Order ID: ${order_id}
Date: ${new Date().toLocaleString()}
------------------------
Items:
${products.map(p => `${p.name} - ₹${p.price.toFixed(2)} x ${p.quantity}`).join('\n')}
------------------------
Subtotal: ₹${subtotal.toFixed(2)}
Shipping: ₹${shipping.toFixed(2)}
Total: ₹${total.toFixed(2)}
Payment Method: ${payment_method}
Shipping Address: ${address}
------------------------
Thank you for shopping with RAASH!
                            `;
                            const mailOptions = {
                                from: process.env.EMAIL_USER,
                                to: req.session.user.email,
                                subject: 'RAASH Order Receipt',
                                text: receiptText
                            };

                            transporter.sendMail(mailOptions, (error) => {
                                if (error) {
                                    console.error('Error sending receipt:', error.message);
                                }
                                db.commit((err) => {
                                    if (err) {
                                        console.error('Commit error:', err.message);
                                        return db.rollback(() => res.status(500).json({ error: 'Transaction commit failed', details: err.message }));
                                    }
                                    if (!req.body.productId) { // Clear cart only if from cart, not single product
                                        db.query('DELETE FROM cart WHERE user_id = ?', [user_id], (err) => {
                                            if (err) console.error('Error clearing cart:', err.message);
                                        });
                                    }
                                    res.json({ success: true, orderId, message: 'Payment successful, receipt sent to your email' });
                                });
                            });
                        }
                    );
                });
            }
        );
    });
});

app.get('/api/orders', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

    db.query(`
        SELECT o.id, o.order_id, o.subtotal, o.shipping, o.total, o.payment_method, o.address, o.status, o.created_at,
               oi.product_id, oi.quantity, p.name, p.price AS unit_price, p.image_path, p.description
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ?`,
        [req.session.user.user_id],
        (err, results) => {
            if (err) {
                console.error('Database error fetching orders:', {
                    code: err.code,
                    message: err.message,
                    sqlState: err.sqlState
                });
                return res.status(500).json({ error: 'Database error', details: err.message });
            }

            const ordersMap = new Map();
            results.forEach(row => {
                if (!ordersMap.has(row.id)) {
                    ordersMap.set(row.id, {
                        id: row.id,
                        order_id: row.order_id,
                        subtotal: row.subtotal,
                        shipping: row.shipping,
                        total: row.total,
                        payment_method: row.payment_method,
                        address: row.address,
                        status: row.status,
                        created_at: row.created_at,
                        products: []
                    });
                }
                if (row.product_id) {
                    ordersMap.get(row.id).products.push({
                        product_id: row.product_id,
                        name: row.name,
                        quantity: row.quantity,
                        unit_price: row.unit_price,
                        image_path: row.image_path || 'images/default.jpg',
                        description: row.description || 'No description available'
                    });
                }
            });

            res.json(Array.from(ordersMap.values()));
        }
    );
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});