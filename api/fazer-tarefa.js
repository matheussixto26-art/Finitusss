const axios = require('axios');

module.exports = async (req, res) => {
    // Adicionamos um log logo no início para ver se a função foi chamada
    console.log("--- INICIANDO /api/fazer-tarefa ---");

    if (req.method !== 'POST') {
        console.log("Método não permitido:", req.method);
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room, tempo, is_expired, submission_type } = req.body;

    // Log para ver o que recebemos do frontend
    console.log("Payload recebido do frontend:", req.body);

    if (!taskId || !token || !room || tempo === undefined || submission_type === undefined) {
        const errorMessage = 'Parâmetros em falta. Tente fazer login novamente.';
        console.error("Erro de validação:", errorMessage, "Payload:", req.body);
        return res.status(400).json({ error: errorMessage });
    }

    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        // --- ETAPA 1: Obter respostas da tarefa (Preview) ---
        const previewPayload = {
            type: "previewTask",
            taskId: taskId,
            room: room,
            token: token
        };
        console.log("A enviar para 'previewTask':", previewPayload);
        
        const previewResponse = await axios.post(API_URL, previewPayload);
        
        // Log CRÍTICO: Vamos ver o que a API de preview nos devolveu
        console.log("Resposta recebida do 'previewTask':", JSON.stringify(previewResponse.data, null, 2));

        const answers = previewResponse.data?.answers;
        if (!answers) {
            const errorMessage = 'Não foi possível obter as respostas da tarefa (Fase 1 de Preview). A resposta não continha "answers".';
            console.error(errorMessage);
            return res.status(500).json({ error: errorMessage });
        }
        console.log("Respostas (answers) obtidas com sucesso!");

        // --- ETAPA 2: Submeter a tarefa ---
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
        console.log("A enviar para 'submit':", submitPayload);

        const submitResponse = await axios.post(API_URL, submitPayload);

        // Log CRÍTICO: Vamos ver a resposta final da submissão
        console.log("Resposta final recebida do 'submit':", JSON.stringify(submitResponse.data, null, 2));
        
        const responseData = submitResponse.data;
        // Verificação mais rigorosa da resposta
        if (!responseData || responseData.success === false || responseData.error) {
             const errorMessage = responseData.message || responseData.error || 'Erro desconhecido retornado pelo servidor de tarefas na submissão final.';
             console.error("A API de submissão retornou um erro:", errorMessage);
             return res.status(400).json({ error: errorMessage });
        }
        
        console.log("Tarefa processada com sucesso na API externa.");
        // Se chegámos até aqui, tudo correu bem.
        res.status(200).json(responseData);

    } catch (error) {
        // Este bloco 'catch' apanha erros de rede ou falhas maiores
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("--- OCORREU UM ERRO GERAL NO 'CATCH' ---");
        console.error("Detalhes do erro:", errorDetails);
        res.status(500).json({ error: `Falha crítica na comunicação com o serviço de tarefas. Detalhes: ${errorDetails}` });
    }
};
