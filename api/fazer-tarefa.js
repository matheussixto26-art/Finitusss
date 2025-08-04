const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room, tempo } = req.body;

    if (!taskId || !token || !room || !tempo) {
        return res.status(400).json({ error: 'Parâmetros em falta. Tente fazer login novamente.' });
    }

    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        // Passo 1: "Visualizar" a tarefa para obter as respostas corretas.
        console.log(`[FASE 1] A pré-visualizar tarefa ${taskId}`);
        const previewResponse = await axios.post(API_URL, {
            type: "previewTask",
            taskId: taskId,
            room: room,
            token: token
        });

        const answers = previewResponse.data?.answers;
        if (!answers) {
            console.error("[ERRO FASE 1] Resposta da pré-visualização não continha 'answers'.", previewResponse.data);
            return res.status(500).json({ error: 'Não foi possível obter as respostas da tarefa (Fase 1).' });
        }
        console.log(`[FASE 1] Respostas obtidas com sucesso para a tarefa ${taskId}`);

        // Passo 2: Submeter a tarefa com as respostas obtidas.
        const submitPayload = {
            type: "submit",
            taskId: taskId,
            token: token,
            tipo: "Pendente",
            tempo: parseInt(tempo, 10),
            status: "submitted",
            accessed_on: "room",
            executed_on: room,
            answers: answers
        };

        console.log(`[FASE 2] A submeter a tarefa ${taskId}`);
        const submitResponse = await axios.post(API_URL, submitPayload);

        // VERIFICAÇÃO DUPLA: Verificar o conteúdo da resposta de submissão
        // Muitos APIs retornam 200 OK mas com uma mensagem de erro no corpo.
        if (submitResponse.data && (submitResponse.data.error || submitResponse.data.success === false)) {
             console.error("[ERRO FASE 2] O servidor de tarefas retornou um erro interno:", submitResponse.data);
             // A mensagem de erro para o utilizador será o que o servidor externo disser.
             const errorMessage = submitResponse.data.message || submitResponse.data.error || 'Erro desconhecido retornado pelo servidor de tarefas.';
             return res.status(400).json({ error: errorMessage });
        }

        console.log(`[FASE 2] Tarefa ${taskId} submetida com sucesso.`);
        // Se chegarmos aqui, tudo correu bem.
        res.status(200).json(submitResponse.data);

    } catch (error) {
        console.error("Erro crítico ao fazer tarefa:", error.response ? error.response.data : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na comunicação com o serviço de tarefas. Detalhes: ${errorDetails}` });
    }
};
