const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'responses.json');

app.use(express.json());
app.use(express.static(__dirname));

// Ensure data directory and file exist
function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
}

function loadResponses() {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
}

function saveResponses(responses) {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(responses, null, 2));
}

// Submit a new assessment response
app.post('/api/submit', (req, res) => {
    const { jobTitle, company, location, scores, averageScore, aiToolsInterest, aiWorkGoals, submittedAt } = req.body;

    if (!jobTitle || !company || !location || !scores || averageScore == null) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const responses = loadResponses();

    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        jobTitle,
        company,
        location,
        scores,
        averageScore,
        aiToolsInterest: aiToolsInterest || '',
        aiWorkGoals: aiWorkGoals || '',
        submittedAt: submittedAt || new Date().toISOString()
    };

    responses.push(entry);
    saveResponses(responses);

    // Calculate comparison stats
    const allScores = responses.map(r => r.averageScore);
    const totalResponses = allScores.length;
    const avgOfAll = allScores.reduce((a, b) => a + b, 0) / totalResponses;
    const highestScore = Math.max(...allScores);

    // Percentile: what percentage of respondents scored lower than this user
    const scoredLower = allScores.filter(s => s < averageScore).length;
    const percentile = Math.round(100 - (scoredLower / totalResponses) * 100);

    // Distribution buckets
    const distribution = {
        novice: allScores.filter(s => s < 3).length,
        beginner: allScores.filter(s => s >= 3 && s < 5).length,
        intermediate: allScores.filter(s => s >= 5 && s < 7).length,
        proficient: allScores.filter(s => s >= 7 && s < 9).length,
        expert: allScores.filter(s => s >= 9).length
    };

    res.json({
        totalResponses,
        averageScore: avgOfAll,
        highestScore,
        percentile,
        distribution
    });
});

// Get aggregate stats (no individual data exposed)
app.get('/api/stats', (req, res) => {
    const responses = loadResponses();

    if (responses.length === 0) {
        return res.json({
            totalResponses: 0,
            averageScore: 0,
            highestScore: 0,
            distribution: { novice: 0, beginner: 0, intermediate: 0, proficient: 0, expert: 0 }
        });
    }

    const allScores = responses.map(r => r.averageScore);
    const totalResponses = allScores.length;
    const averageScore = allScores.reduce((a, b) => a + b, 0) / totalResponses;
    const highestScore = Math.max(...allScores);

    const distribution = {
        novice: allScores.filter(s => s < 3).length,
        beginner: allScores.filter(s => s >= 3 && s < 5).length,
        intermediate: allScores.filter(s => s >= 5 && s < 7).length,
        proficient: allScores.filter(s => s >= 7 && s < 9).length,
        expert: allScores.filter(s => s >= 9).length
    };

    res.json({ totalResponses, averageScore, highestScore, distribution });
});

app.listen(PORT, () => {
    console.log(`AI Assessment server running at http://localhost:${PORT}`);
});
