const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room, tempo } = req.body;

    if (!taskId || !token || !room || !tempo) {
        return res.status(400).json({ error: 'Todos os parâmetros são obrigatórios: taskId, token, room, tempo.' });
    }

    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        // Passo 1: "Visualizar" a tarefa para obter as respostas corretas.
        // O site moonscripts faz isso para pegar as respostas prontas.
        const previewResponse = await axios.post(API_URL, {
            type: "previewTask",
            taskId: taskId,
            room: room,
            token: token
        });

        // Extrai as respostas do resultado da visualização.
        const answers = previewResponse.data?.answers;
        if (!answers) {
            return res.status(500).json({ error: 'Não foi possível obter as respostas da tarefa.' });
        }

        // Passo 2: Submeter a tarefa com as respostas obtidas.
        const submitPayload = {
            type: "submit",
            taskId: taskId,
            token: token,
            tipo: "Pendente",
            tempo: parseInt(tempo, 10), // Usa o tempo que o usuário escolheu
            status: "submitted",
            accessed_on: "room",
            executed_on: room,
            answers: answers
        };

        const submitResponse = await axios.post(API_URL, submitPayload);

        // Retorna a resposta final para o nosso frontend.
        res.status(200).json(submitResponse.data);

    } catch (error) {
        console.error("Erro ao fazer tarefa:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Falha ao comunicar com o serviço de tarefas.', details: error.response ? error.response.data : null });
    }
};
      
