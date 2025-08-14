const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, tokenB, room } = req.body;
    if (!taskId || !tokenB || !room) {
        return res.status(400).json({ error: 'taskId, tokenB e room são obrigatórios.' });
    }

    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        const previewPayload = { type: "previewTask", taskId, room, token: tokenB };
        const previewResponse = await axios.post(API_URL, previewPayload);
        
        // --- NOVA VERIFICAÇÃO DE SEGURANÇA ---
        // Se a resposta não tiver o objeto 'answers', consideramos uma falha.
        if (!previewResponse.data || !previewResponse.data.answers) {
            console.error("Resposta inválida do fornecedor de gabarito:", previewResponse.data);
            return res.status(502).json({ error: "Fornecedor de gabarito retornou resposta inválida." });
        }

        res.status(200).json(previewResponse.data);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`Falha em obter-respostas para taskId ${taskId}:`, errorDetails);
        res.status(500).json({ error: `Falha ao obter gabarito.`, details: errorDetails });
    }
};
