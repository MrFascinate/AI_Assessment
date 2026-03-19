const { fetchAllScores } = require('./airtable');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const allScores = await fetchAllScores();

    if (allScores.length === 0) {
        return res.status(200).json({
            totalResponses: 0,
            averageScore: 0,
            highestScore: 0,
            distribution: { novice: 0, beginner: 0, intermediate: 0, proficient: 0, expert: 0 }
        });
    }

    const totalResponses = allScores.length;
    const scoreSum = allScores.reduce((a, b) => a + b, 0);
    const highestScore = Math.max(...allScores);

    const distribution = {
        novice: allScores.filter(s => s < 3).length,
        beginner: allScores.filter(s => s >= 3 && s < 5).length,
        intermediate: allScores.filter(s => s >= 5 && s < 7).length,
        proficient: allScores.filter(s => s >= 7 && s < 9).length,
        expert: allScores.filter(s => s >= 9).length,
    };

    res.status(200).json({
        totalResponses,
        averageScore: scoreSum / totalResponses,
        highestScore,
        distribution,
    });
};
