const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// File storage setup
const DATA_FILE = path.join(__dirname, 'data', 'submissions.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// Load existing data
let submissions = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    submissions = JSON.parse(fs.readFileSync(DATA_FILE));
  }
} catch (err) {
  console.error('Error reading data file:', err);
}

// POST endpoint for inventory submissions
app.post('/api/submit', (req, res) => {
  const { distributor_name, town, super_stockist, state, entered_by, mobile, items } = req.body;

  // Validation
  if (!distributor_name || !town || !state || !mobile || !items || items.length === 0) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  // Validate each item
  for (const item of items) {
    if (!item.item_name || 
        typeof item.opening_stock !== 'number' || 
        typeof item.purchase !== 'number' || 
        typeof item.sale !== 'number') {
      return res.status(400).json({ message: 'Invalid item data' });
    }
  }

  // Create submission with timestamp
  const newSubmission = {
    distributor_name,
    town,
    super_stockist: super_stockist || '',
    state,
    entered_by: entered_by || '',
    mobile,
    items: items.map(item => ({
      item_name: item.item_name,
      opening_stock: item.opening_stock,
      purchase: item.purchase,
      sale: item.sale,
      closing_stock: item.opening_stock + item.purchase - item.sale
    })),
    submitted_at: new Date().toISOString()
  };

  // Add to submissions
  submissions.push(newSubmission);

  // Save to file
  fs.writeFile(DATA_FILE, JSON.stringify(submissions, null, 2), (err) => {
    if (err) {
      console.error('Error saving data:', err);
      return res.status(500).json({ message: 'Error saving data' });
    }
    
    console.log('New submission saved:', newSubmission.distributor_name);
    res.json({ 
      message: 'Inventory data submitted successfully!',
      data: newSubmission
    });
  });
});

// GET endpoint for all submissions
app.get('/api/submissions', (req, res) => {
  res.json(submissions);
});

// GET endpoint for records
app.get('/api/records', (req, res) => {
  res.json(submissions);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Data will be stored in: ${DATA_FILE}`);
});