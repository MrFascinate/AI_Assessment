// Shared Airtable helpers for Vercel serverless functions

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Responses';
const API_TOKEN = process.env.AIRTABLE_API_TOKEN;

function airtableUrl(path) {
    return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}${path}`;
}

async function airtableFetch(path, options = {}) {
    const res = await fetch(airtableUrl(path), {
        ...options,
        headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Airtable error ${res.status}: ${body}`);
    }

    return res.json();
}

// Fetch all averageScore values from every record (handles pagination)
async function fetchAllScores() {
    const scores = [];
    let offset;

    do {
        const params = new URLSearchParams({
            'fields[]': 'averageScore',
            pageSize: '100',
        });
        if (offset) params.set('offset', offset);

        const data = await airtableFetch(`?${params.toString()}`);

        for (const record of data.records) {
            if (record.fields.averageScore != null) {
                scores.push(record.fields.averageScore);
            }
        }

        offset = data.offset;
    } while (offset);

    return scores;
}

module.exports = { airtableFetch, fetchAllScores };
