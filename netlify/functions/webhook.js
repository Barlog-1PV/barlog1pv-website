exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const WEBHOOK_URL = 'https://discord.com/api/webhooks/1496570610439159949/4KK5f5NxRtDp2k8UdzInqapbJvTvtGPoxakMvItlQ82Ggm_pCS5qaPnjpYNF6D3Q7yM6';

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
