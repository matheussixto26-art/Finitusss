const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room, tempo, is_expired, submission_type } = req.body;

    if (!taskId || !token || !room || !tempo || !submission_type) {
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
            status: submission_type,
            accessed_on: "room",
            executed_on: room,
            answers: answers
        };

        const submitResponse = await axios.post(API_URL, submitPayload);

        // MODIFICAÇÃO DE DIAGNÓSTICO:
        // Vamos verificar a resposta de uma forma mais rigorosa.
        // Se a resposta não contiver um campo específico que indique sucesso, consideramos um erro.
        // Vamos assumir que uma resposta de sucesso DEVE ter um campo "answer".
        if (!submitResponse.data || !submitResponse.data.answer) {
             console.error("[ERRO TAREFA DIAGNÓSTICO] O servidor externo não retornou uma confirmação de sucesso. Resposta recebida:", submitResponse.data);
             
             // Envia a resposta completa do erro para o frontend.
             const detailedError = JSON.stringify(submitResponse.data);
             return res.status(400).json({ error: `O servidor externo não confirmou o sucesso. Resposta completa: ${detailedError}` });
        }

        res.status(200).json(submitResponse.data);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na comunicação com o serviço de tarefas. Detalhes: ${errorDetails}` });
    }
};
