const { Redis } = require('@upstash/redis');
const { sendToAirtable } = require('./airtable');

const redisUrl = process.env.NEWDATA_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.NEWDATA_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fullName, email, jobTitle, company, location, scores, warmup, averageScore, aiToolsInterest, aiWorkGoals, submittedAt } = req.body;

    if (!fullName || !email || !jobTitle || !company || !location || !scores || averageScore == null) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const entryId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    let level;
    if (averageScore < 3) level = 'novice';
    else if (averageScore < 5) level = 'beginner';
    else if (averageScore < 7) level = 'intermediate';
    else if (averageScore < 9) level = 'proficient';
    else level = 'expert';

    // Always save to Airtable
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

    // Try Redis for stats, but don't fail if unavailable
    if (!redis) {
        return res.status(200).json({
            totalResponses: null,
            averageScore: null,
            highestScore: null,
            percentile: null,
            distribution: null,
        });
    }

    try {
        const totalResponses = await redis.incr('total_responses');
        const scoreSum = await redis.incrbyfloat('score_sum', averageScore);

        const currentHighest = await redis.get('highest_score');
        const highestScore = (currentHighest === null || averageScore > parseFloat(currentHighest))
            ? averageScore
            : parseFloat(currentHighest);
        if (averageScore >= highestScore) {
            await redis.set('highest_score', averageScore);
        }

        let bucket;
        if (averageScore < 3) bucket = 'dist:novice';
        else if (averageScore < 5) bucket = 'dist:beginner';
        else if (averageScore < 7) bucket = 'dist:intermediate';
        else if (averageScore < 9) bucket = 'dist:proficient';
        else bucket = 'dist:expert';
        await redis.incr(bucket);

        await redis.zadd('scores', { score: averageScore, member: entryId });

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

        res.status(200).json({
            totalResponses,
            averageScore: scoreSum / totalResponses,
            highestScore,
            percentile,
            distribution,
        });
    } catch (err) {
        console.error('Redis error (non-fatal):', err.message);
        res.status(200).json({
            totalResponses: null,
            averageScore: null,
            highestScore: null,
            percentile: null,
            distribution: null,
        });
    }
};
