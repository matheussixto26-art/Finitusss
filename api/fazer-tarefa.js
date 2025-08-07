const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    // Adicionado submission_type aqui para clareza
    const { taskId, token, room, tempo, is_expired, submission_type } = req.body;

    if (!taskId || !token || !room || tempo === undefined || submission_type === undefined) {
        return res.status(400).json({ error: 'Parâmetros em falta. Tente fazer login novamente.' });
    }

    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        const previewResponse = await axios.post(API_URL, {
            type: "previewTask",
            taskId: taskId,
            room: room,
            token: token
        });

        const answers = previewResponse.data?.answers;
        if (!answers) {
            return res.status(500).json({ error: 'Não foi possível obter as respostas da tarefa (Fase 1).' });
        }

        const tipoTarefa = is_expired ? "Expirada" : "Pendente";

        const submitPayload = {
            type: "submit",
            taskId: taskId,
            token: token,
            tipo: tipoTarefa,
            tempo: parseInt(tempo, 10),
            status: submission_type, // "submitted" ou "draft"
            accessed_on: "room",
            executed_on: room,
            answers: answers
        };

        const submitResponse = await axios.post(API_URL, submitPayload);

        const responseData = submitResponse.data;
        if (responseData && (responseData.error || responseData.success === false)) {
             const errorMessage = responseData.message || responseData.error || 'Erro desconhecido retornado pelo servidor de tarefas.';
             return res.status(400).json({ error: errorMessage });
        }

        res.status(200).json(responseData);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na comunicação com o serviço de tarefas. Detalhes: ${errorDetails}` });
    }
};
