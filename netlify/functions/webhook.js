const { Buffer } = require('buffer');
const Busboy = require('busboy');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    if (!WEBHOOK_URL) {
        return { statusCode: 500, body: JSON.stringify({ error: "DISCORD_WEBHOOK_URL manquant." }) };
    }

    return new Promise((resolve) => {
        const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
        const busboy = Busboy({ headers: { 'content-type': contentType } });

        let payloadJson = null;
        let fileBuffer = null;
        let fileName = null;
        let fileMime = null;

        busboy.on('field', (name, value) => {
            if (name === 'payload_json') payloadJson = value;
        });

        busboy.on('file', (name, stream, info) => {
            fileName = info.filename;
            fileMime = info.mimeType;
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
        });

        busboy.on('finish', async () => {
            try {
                const formData = new FormData();
                formData.append('payload_json', payloadJson);

                if (fileBuffer && fileName) {
                    const blob = new Blob([fileBuffer], { type: fileMime });
                    formData.append('file[0]', blob, fileName);
                }

                const response = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    body: formData
                });

                if (response.status === 200 || response.status === 204) {
                    resolve({ statusCode: 200, body: JSON.stringify({ success: true }) });
                } else {
                    const text = await response.text();
                    resolve({ statusCode: response.status, body: text });
                }
            } catch (err) {
                resolve({ statusCode: 500, body: JSON.stringify({ error: err.message }) });
            }
        });

        const body = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : Buffer.from(event.body);

        busboy.write(body);
        busboy.end();
    });
};