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
        const previewPayload = {
            type: "previewTask",
            taskId: taskId,
            room: room,
            token: tokenB
        };
        
        const previewResponse = await axios.post(API_URL, previewPayload);
        
        if (!previewResponse.data?.answers) {
            throw new Error('A resposta da API de preview não continha o objeto "answers".');
        }

        // Devolve apenas a resposta da API de preview
        res.status(200).json(previewResponse.data);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha ao obter respostas da tarefa. Detalhes: ${errorDetails}` });
    }
};
