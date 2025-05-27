require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Successfully connected to PostgreSQL database');
  }
});

// Initialize database tables
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS distributors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        town VARCHAR(255) NOT NULL,
        super_stockist VARCHAR(255),
        state VARCHAR(255) NOT NULL,
        entered_by VARCHAR(255),
        mobile VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        distributor_id INTEGER REFERENCES distributors(id) ON DELETE CASCADE,
        item_name VARCHAR(255) NOT NULL,
        opening_stock INTEGER NOT NULL DEFAULT 0,
        purchase INTEGER NOT NULL DEFAULT 0,
        sale INTEGER NOT NULL DEFAULT 0,
        closing_stock INTEGER NOT NULL DEFAULT 0
      );
    `);
    console.log("Database tables initialized");
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

// API Endpoints

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: pool ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Submit inventory data with validation
app.post('/api/submit', [
  body('distributor_name').trim().notEmpty().withMessage('Distributor name is required'),
  body('town').trim().notEmpty().withMessage('Town is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('mobile').trim().isMobilePhone().withMessage('Valid mobile number is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one inventory item is required'),
  body('items.*.item_name').trim().notEmpty().withMessage('Item name is required'),
  body('items.*.opening_stock').isInt({ min: 0 }).withMessage('Opening stock must be a positive number'),
  body('items.*.purchase').isInt({ min: 0 }).withMessage('Purchase must be a positive number'),
  body('items.*.sale').isInt({ min: 0 }).withMessage('Sale must be a positive number')
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert distributor
    const distRes = await client.query(
      `INSERT INTO distributors (name, town, super_stockist, state, entered_by, mobile)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        req.body.distributor_name,
        req.body.town,
        req.body.super_stockist || null,
        req.body.state,
        req.body.entered_by || null,
        req.body.mobile
      ]
    );

    // Insert all items
    for (const item of req.body.items) {
      await client.query(
        `INSERT INTO inventory_items 
        (distributor_id, item_name, opening_stock, purchase, sale, closing_stock)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          distRes.rows[0].id,
          item.item_name,
          item.opening_stock || 0,
          item.purchase || 0,
          item.sale || 0,
          (item.opening_stock || 0) + (item.purchase || 0) - (item.sale || 0)
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Inventory data saved successfully!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Database error:", err);
    res.status(500).json({ error: 'Failed to save inventory data' });
  } finally {
    client.release();
  }
});

// Get all records
app.get('/api/records', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        d.id,
        d.name as distributor_name,
        d.town,
        d.state,
        d.mobile,
        d.created_at as submitted_at,
        json_agg(json_build_object(
          'item_name', i.item_name,
          'opening_stock', i.opening_stock,
          'purchase', i.purchase,
          'sale', i.sale,
          'closing_stock', i.closing_stock
        )) as items
      FROM distributors d
      JOIN inventory_items i ON d.id = i.distributor_id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Get filtered records
app.get('/api/records/filter', async (req, res) => {
  const { startDate, endDate, distributor } = req.query;
  
  try {
    let query = `
      SELECT 
        d.id,
        d.name as distributor_name,
        d.town,
        d.state,
        d.created_at as submitted_at,
        json_agg(json_build_object(
          'item_name', i.item_name,
          'opening_stock', i.opening_stock,
          'purchase', i.purchase,
          'sale', i.sale,
          'closing_stock', i.closing_stock
        )) as items
      FROM distributors d
      JOIN inventory_items i ON d.id = i.distributor_id
    `;

    const params = [];
    const conditions = [];
    
    if (startDate) {
      conditions.push(`d.created_at >= $${params.length + 1}`);
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push(`d.created_at <= $${params.length + 1}`);
      params.push(endDate);
    }
    
    if (distributor) {
      conditions.push(`d.name = $${params.length + 1}`);
      params.push(distributor);
    }
    
    if (conditions.length) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY d.id ORDER BY d.created_at DESC`;
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: 'Failed to filter records' });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  pool.end(() => {
    console.log('Database pool ended');
    process.exit(0);
  });
});

// Initialize database and start server
initDB().then(() => {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
    server.close(() => process.exit(1));
  });
});