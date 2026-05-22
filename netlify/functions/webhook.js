exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

        // Sécurité si la variable est manquante sur Netlify
        if (!WEBHOOK_URL) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "La variable DISCORD_WEBHOOK_URL n'est pas configurée sur Netlify." })
            };
        }

        // On récupère le body proprement
        const bodyContent = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64').toString('utf-8')
            : event.body;

        // Requête vers Discord
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': event.headers['content-type'] || event.headers['Content-Type'] || 'application/json',
            },
            body: bodyContent
        });

        // Si Discord renvoie un statut 204 (No Content), c'est une réussite totale
        if (response.status === 204) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true })
            };
        }

        const data = await response.text();
        return {
            statusCode: response.status,
            body: data
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || err.toString() })
        };
    }
};