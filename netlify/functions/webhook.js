exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

        const bodyBuffer = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': event.headers['content-type'] || event.headers['Content-Type'],
            },
            body: bodyBuffer
        });

        const data = await response.text();

        return {
            statusCode: response.status,
            body: data
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.toString() })
        };
    }
};
