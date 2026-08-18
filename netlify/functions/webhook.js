const { Buffer } = require('buffer');
const Busboy = require('busboy');

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 3;

const rateLimitStore = new Map();

function rateLimit(key) {
    const now = Date.now();
    const existing = rateLimitStore.get(key);

    if (!existing || existing.resetAt <= now) {
        const fresh = {
            count: 1,
            resetAt: now + WINDOW_MS
        };

        rateLimitStore.set(key, fresh);

        return {
            success: true,
            remaining: MAX_REQUESTS - 1,
            resetAt: fresh.resetAt
        };
    }

    if (existing.count >= MAX_REQUESTS) {
        return {
            success: false,
            remaining: 0,
            resetAt: existing.resetAt
        };
    }

    existing.count += 1;
    rateLimitStore.set(key, existing);

    return {
        success: true,
        remaining: MAX_REQUESTS - existing.count,
        resetAt: existing.resetAt
    };
}

const cleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt <= now) {
            rateLimitStore.delete(key);
        }
    }
}, 60 * 1000);

cleanupInterval.unref();

function getClientIp(event) {
    const forwardedFor =
        event.headers?.['x-forwarded-for'] ||
        event.headers?.['X-Forwarded-For'];

    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }

    return (
        event.headers?.['x-nf-client-connection-ip'] ||
        event.headers?.['X-Nf-Client-Connection-Ip'] ||
        event.requestContext?.identity?.sourceIp ||
        event.requestContext?.http?.sourceIp ||
        'unknown'
    );
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    const clientIp = getClientIp(event);
    const limit = rateLimit(clientIp);

    if (!limit.success) {
        const retryAfterSeconds = Math.max(
            1,
            Math.ceil((limit.resetAt - Date.now()) / 1000)
        );

        return {
            statusCode: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfterSeconds),
                'X-RateLimit-Limit': String(MAX_REQUESTS),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(
                    Math.ceil(limit.resetAt / 1000)
                )
            },
            body: JSON.stringify({
                error: 'Too many requests.',
                retryAfter: retryAfterSeconds
            })
        };
    }

    const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!WEBHOOK_URL) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'DISCORD_WEBHOOK_URL manquant.'
            })
        };
    }

    return new Promise((resolve) => {
        const contentType =
            event.headers['content-type'] ||
            event.headers['Content-Type'] ||
            '';

        const busboy = Busboy({
            headers: {
                'content-type': contentType
            }
        });

        let payloadJson = null;
        let fileBuffer = null;
        let fileName = null;
        let fileMime = null;

        busboy.on('field', (name, value) => {
            if (name === 'payload_json') {
                payloadJson = value;
            }
        });

        busboy.on('file', (name, stream, info) => {
            fileName = info.filename;
            fileMime = info.mimeType;

            const chunks = [];

            stream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                fileBuffer = Buffer.concat(chunks);
            });
        });

        busboy.on('finish', async () => {
            try {
                const formData = new FormData();

                formData.append('payload_json', payloadJson);

                if (fileBuffer && fileName) {
                    const blob = new Blob(
                        [fileBuffer],
                        { type: fileMime }
                    );

                    formData.append(
                        'file[0]',
                        blob,
                        `SPOILER_${fileName}`
                    );
                }

                const response = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    body: formData
                });

                if (
                    response.status === 200 ||
                    response.status === 204
                ) {
                    resolve({
                        statusCode: 200,
                        headers: {
                            'X-RateLimit-Limit':
                                String(MAX_REQUESTS),
                            'X-RateLimit-Remaining':
                                String(limit.remaining),
                            'X-RateLimit-Reset':
                                String(Math.ceil(limit.resetAt / 1000))
                        },
                        body: JSON.stringify({
                            success: true
                        })
                    });
                } else {
                    const text = await response.text();

                    resolve({
                        statusCode: response.status,
                        body: text
                    });
                }
            } catch (err) {
                resolve({
                    statusCode: 500,
                    body: JSON.stringify({
                        error: err.message
                    })
                });
            }
        });

        const body = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : Buffer.from(event.body);

        busboy.write(body);
        busboy.end();
    });
};