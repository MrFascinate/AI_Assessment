const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Re-use the same Airtable-backed API handlers
const submitHandler = require('./api/submit');
const statsHandler = require('./api/stats');

app.post('/api/submit', (req, res) => submitHandler(req, res));
app.get('/api/stats', (req, res) => statsHandler(req, res));

app.listen(PORT, () => {
    console.log(`AI Assessment server running at http://localhost:${PORT}`);
});
