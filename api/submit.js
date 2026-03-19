const { fetchAllScores, airtableFetch } = require('./airtable');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fullName, email, jobTitle, company, location, scores, averageScore, aiToolsInterest, aiWorkGoals, submittedAt } = req.body;

    if (!fullName || !email || !jobTitle || !company || !location || !scores || averageScore == null) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine level bucket
    let level;
    if (averageScore < 3) level = 'novice';
    else if (averageScore < 5) level = 'beginner';
    else if (averageScore < 7) level = 'intermediate';
    else if (averageScore < 9) level = 'proficient';
    else level = 'expert';

    // Build Airtable record fields
    const fields = {
        fullName,
        email,
        jobTitle,
        company,
        location,
        averageScore,
        level,
        aiToolsInterest: aiToolsInterest || '',
        aiWorkGoals: aiWorkGoals || '',
        submittedAt: submittedAt || new Date().toISOString(),
    };

    // Flatten individual question scores into separate columns
    for (let i = 1; i <= 10; i++) {
        if (scores[`q${i}`] != null) {
            fields[`q${i}`] = scores[`q${i}`];
        }
    }

    // Create the record in Airtable
    await airtableFetch('', {
        method: 'POST',
        body: JSON.stringify({ records: [{ fields }] }),
    });

    // Fetch all scores for comparison stats
    const allScores = await fetchAllScores();
    const totalResponses = allScores.length;
    const scoreSum = allScores.reduce((a, b) => a + b, 0);
    const highestScore = Math.max(...allScores);

    // Percentile: percentage of respondents who scored lower
    const scoredLower = allScores.filter(s => s < averageScore).length;
    const percentile = totalResponses <= 1
        ? 100
        : Math.max(1, Math.round((scoredLower / (totalResponses - 1)) * 100));

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
        percentile,
        distribution,
    });
};
