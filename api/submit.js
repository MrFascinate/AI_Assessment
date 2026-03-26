const { Redis } = require('@upstash/redis');
const { sendToAirtable } = require('./airtable');

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fullName, email, jobTitle, company, location, scores, warmup, averageScore, aiToolsInterest, aiWorkGoals, submittedAt } = req.body;

    if (!fullName || !email || !jobTitle || !company || !location || !scores || averageScore == null) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const entryId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // --- Redis: fast stats engine ---

    // Update aggregate stats atomically
    const totalResponses = await redis.incr('total_responses');
    const scoreSum = await redis.incrbyfloat('score_sum', averageScore);

    // Track the highest score
    const currentHighest = await redis.get('highest_score');
    const highestScore = (currentHighest === null || averageScore > parseFloat(currentHighest))
        ? averageScore
        : parseFloat(currentHighest);
    if (averageScore >= highestScore) {
        await redis.set('highest_score', averageScore);
    }

    // Increment distribution bucket
    let bucket;
    if (averageScore < 3) bucket = 'dist:novice';
    else if (averageScore < 5) bucket = 'dist:beginner';
    else if (averageScore < 7) bucket = 'dist:intermediate';
    else if (averageScore < 9) bucket = 'dist:proficient';
    else bucket = 'dist:expert';
    await redis.incr(bucket);

    // Add score to sorted set for percentile calculation
    await redis.zadd('scores', { score: averageScore, member: entryId });

    // Percentile: use zrank to get count of members with lower scores
    const rank = await redis.zrank('scores', entryId);
    const percentile = totalResponses <= 1
        ? 100
        : Math.max(1, Math.round(100 - (rank / (totalResponses - 1)) * 100));

    const distribution = {
        novice: parseInt(await redis.get('dist:novice')) || 0,
        beginner: parseInt(await redis.get('dist:beginner')) || 0,
        intermediate: parseInt(await redis.get('dist:intermediate')) || 0,
        proficient: parseInt(await redis.get('dist:proficient')) || 0,
        expert: parseInt(await redis.get('dist:expert')) || 0,
    };

    // --- Airtable: browsable copy (await to ensure it completes before function exits) ---
    let level;
    if (averageScore < 3) level = 'novice';
    else if (averageScore < 5) level = 'beginner';
    else if (averageScore < 7) level = 'intermediate';
    else if (averageScore < 9) level = 'proficient';
    else level = 'expert';

    try {
        await sendToAirtable({
            fullName, email, jobTitle, company, location,
            averageScore, level,
            aiToolsInterest: aiToolsInterest || '',
            aiWorkGoals: aiWorkGoals || '',
            submittedAt: submittedAt || new Date().toISOString(),
            scores, warmup,
        });
    } catch (err) {
        console.error('Airtable write failed:', err.message);
    }

    res.status(200).json({
        totalResponses,
        averageScore: scoreSum / totalResponses,
        highestScore,
        percentile,
        distribution,
    });
};
