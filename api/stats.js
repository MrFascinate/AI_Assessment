const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const totalResponses = parseInt(await redis.get('total_responses')) || 0;

    if (totalResponses === 0) {
        return res.status(200).json({
            totalResponses: 0,
            averageScore: 0,
            highestScore: 0,
            distribution: { novice: 0, beginner: 0, intermediate: 0, proficient: 0, expert: 0 }
        });
    }

    const scoreSum = parseFloat(await redis.get('score_sum')) || 0;
    const highestScore = parseFloat(await redis.get('highest_score')) || 0;

    const distribution = {
        novice: parseInt(await redis.get('dist:novice')) || 0,
        beginner: parseInt(await redis.get('dist:beginner')) || 0,
        intermediate: parseInt(await redis.get('dist:intermediate')) || 0,
        proficient: parseInt(await redis.get('dist:proficient')) || 0,
        expert: parseInt(await redis.get('dist:expert')) || 0,
    };

    res.status(200).json({
        totalResponses,
        averageScore: scoreSum / totalResponses,
        highestScore,
        distribution
    });
};
