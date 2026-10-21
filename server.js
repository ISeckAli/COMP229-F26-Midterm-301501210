
/**
 * Midterm API Project - COMP229
 * Student: Ivan Seck Ali
 * Student ID: 301501210
 *
 * REST API for managing an equipment collection.
 * Equipment IDs are array indexes starting from 0.
 */

import express from 'express';

const app = express();
app.use(express.json());

// Five original items and two personalized additions.
// Student ID ends in 0: added items must be from 1990-1999.
let equipment = [
  { name: 'USB Microphone', category: 'audio', brand: 'AudioLab', year: 2021, quantity: 5 },
  { name: 'LED Panel', category: 'lighting', brand: 'BrightWorks', year: 2022, quantity: 4 },
  { name: 'Network Switch', category: 'networking', brand: 'NetCore', year: 2020, quantity: 3 },
  { name: 'Cable Tester', category: 'tools', brand: 'TestPro', year: 2019, quantity: 6 },
  { name: 'Studio Headphones', category: 'audio', brand: 'SoundCraft', year: 2023, quantity: 8 },
  { name: 'VHS Camcorder', category: 'video', brand: 'Panasonic', year: 1995, quantity: 2 },
  { name: 'CD Recorder', category: 'audio', brand: 'Philips', year: 1998, quantity: 3 }
];

// Check that all required equipment fields are valid.
function isValidEquipment(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return false;
  }

  return (
    typeof item.name === 'string' &&
    item.name.trim() !== '' &&
    typeof item.category === 'string' &&
    item.category.trim() !== '' &&
    typeof item.brand === 'string' &&
    item.brand.trim() !== '' &&
    Number.isInteger(item.year) &&
    item.year > 0 &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 0
  );
}

// Convert and validate the array index supplied in the URL.
function getValidIndex(id) {
  if (!/^(0|[1-9]\d*)$/.test(id)) {
    return -1;
  }

  const index = Number(id);

  if (!Number.isSafeInteger(index) || index >= equipment.length) {
    return -1;
  }

  return index;
}

// 1. GET - Retrieve all equipment.
app.get('/api/equipment', (req, res) => {
  res.status(200).json(equipment);
});

// 2. GET - Filter equipment by category.
// Keep this route before /api/equipment/:id.
app.get('/api/equipment/filter', (req, res) => {
  const { category } = req.query;

  if (typeof category !== 'string' || category.trim() === '') {
    return res.status(400).json({
      error: 'A valid category query parameter is required.'
    });
  }

  const filteredEquipment = equipment.filter(
    item => item.category.toLowerCase() === category.trim().toLowerCase()
  );

  res.status(200).json(filteredEquipment);
});

// 3. GET - Retrieve one equipment item by array index.
app.get('/api/equipment/:id', (req, res) => {
  const index = getValidIndex(req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: 'Equipment item not found.'
    });
  }

  res.status(200).json(equipment[index]);
});

// 4. POST - Add a new equipment item.
app.post('/api/equipment', (req, res) => {
  const newEquipment = req.body;

  if (!isValidEquipment(newEquipment)) {
    return res.status(400).json({
      error: 'Invalid equipment data. Check all required fields and data types.'
    });
  }

  equipment.push({
    name: newEquipment.name,
    category: newEquipment.category,
    brand: newEquipment.brand,
    year: newEquipment.year,
    quantity: newEquipment.quantity
  });

  res.status(201).json(equipment[equipment.length - 1]);
});

// 5. PUT - Update equipment at the specified array index.
app.put('/api/equipment/:id', (req, res) => {
  const index = getValidIndex(req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: 'Equipment item not found.'
    });
  }

  if (!isValidEquipment(req.body)) {
    return res.status(400).json({
      error: 'Invalid equipment data. Check all required fields and data types.'
    });
  }

  equipment[index] = {
    name: req.body.name,
    category: req.body.category,
    brand: req.body.brand,
    year: req.body.year,
    quantity: req.body.quantity
  };

  res.status(200).json(equipment[index]);
});

// 6. DELETE - Remove equipment at the specified array index.
app.delete('/api/equipment/:id', (req, res) => {
  const index = getValidIndex(req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: 'Equipment item not found.'
    });
  }

  const removedEquipment = equipment.splice(index, 1);

  res.status(200).json(removedEquipment[0]);
});

// Start the Express server on port 3000.
const PORT = process.env.PORT || 3000;

app.listen(PORT, '127.0.0.1', err => {
  if (err) {
    console.error(`Cannot start on port ${PORT}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Server is running on http://localhost:${PORT}`);
});
