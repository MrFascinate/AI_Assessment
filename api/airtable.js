// Airtable helper — fire-and-forget copy of each submission for browsing

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Responses';
const API_TOKEN = process.env.AIRTABLE_API_TOKEN;

function airtableUrl() {
    return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
}

async function sendToAirtable({ fullName, email, jobTitle, company, location, averageScore, level, aiToolsInterest, aiWorkGoals, submittedAt, scores, warmup }) {
    if (!BASE_ID || !API_TOKEN) return; // Skip if Airtable isn't configured

    const fields = {
        fullName, email, jobTitle, company, location,
        averageScore, level,
        aiToolsInterest, aiWorkGoals, submittedAt,
    };

    // Flatten question scores into separate columns
    for (let i = 1; i <= 10; i++) {
        if (scores && scores[`q${i}`] != null) {
            fields[`q${i}`] = scores[`q${i}`];
        }
    }

    // Flatten warm-up answers
    if (warmup) {
        for (let i = 1; i <= 3; i++) {
            if (warmup[`warmup${i}`]) {
                fields[`warmup${i}`] = warmup[`warmup${i}`];
            }
        }
    }

    const res = await fetch(airtableUrl(), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: [{ fields }] }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Airtable error ${res.status}: ${body}`);
    }
}

module.exports = { sendToAirtable };
