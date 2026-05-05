const { Redis } = require('@upstash/redis');

const redisUrl = process.env.NEWDATA_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.NEWDATA_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const emptyStats = {
    totalResponses: 0,
    averageScore: 0,
    highestScore: 0,
    distribution: { novice: 0, beginner: 0, intermediate: 0, proficient: 0, expert: 0 }
};

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!redis) {
        return res.status(200).json(emptyStats);
    }

    try {
        const totalResponses = parseInt(await redis.get('total_responses')) || 0;

        if (totalResponses === 0) {
            return res.status(200).json(emptyStats);
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
            distribution,
        });
    } catch (err) {
        console.error('Redis stats error (non-fatal):', err.message);
        res.status(200).json(emptyStats);
    }
};
