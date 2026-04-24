exports.handler = async (event, context) => {
    // On n'accepte que les requêtes POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // L'URL du webhook Discord cachée côté serveur
        const WEBHOOK_URL = 'https://discord.com/api/webhooks/1496570610439159949/4KK5f5NxRtDp2k8UdzInqapbJvTvtGPoxakMvItlQ82Ggm_pCS5qaPnjpYNF6D3Q7yM6';

        // Netlify peut encoder le corps de la requête en base64 (surtout pour les fichiers)
        // On vérifie et on décode si nécessaire pour envoyer les vraies données à Discord
        const bodyBuffer = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

        // On transfère la requête à Discord
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                // Il est crucial de conserver le Content-Type original (qui contient le "boundary" du multipart/form-data)
                'Content-Type': event.headers['content-type'] || event.headers['Content-Type'],
            },
            body: bodyBuffer
        });

        // Discord retourne le texte de la réponse (ou vide si tout s'est bien passé pour un POST de base)
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
