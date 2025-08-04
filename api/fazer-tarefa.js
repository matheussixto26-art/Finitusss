const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { taskId, token, room, tempo, is_expired, submission_type, errorCount } = req.body;
    
    console.log(`[TAREFA INICIADA] ID: ${taskId}, Ação: ${submission_type}`);

    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        console.log(`[TAREFA ETAPA 1] A pedir respostas ao serviço externo para a tarefa ${taskId}.`);
        const previewResponse = await axios.post(API_URL, { type: "previewTask", taskId, room, token });
        
        let answers = previewResponse.data?.answers;
        if (!answers) {
            console.error(`[ERRO TAREFA] O serviço externo não retornou respostas para a tarefa ${taskId}.`);
            return res.status(500).json({ error: 'O serviço externo não retornou as respostas da tarefa.' });
        }
        console.log(`[TAREFA ETAPA 1] Respostas recebidas com sucesso.`);

        // A lógica de errar questões continua funcional.
        function introduceErrors(ans, count) { if (count <= 0) return ans; const newAns = JSON.parse(JSON.stringify(ans)); const qIds = Object.keys(newAns); let errorsMade = 0; for (const qId of qIds) { if (errorsMade >= count) break; const options = Object.keys(newAns[qId].answer); const correctIdx = options.findIndex(k => newAns[qId].answer[k] === true); if (correctIdx > -1) { const wrongIdx = options.findIndex(k => newAns[qId].answer[k] === false); if (wrongIdx > -1) { newAns[qId].answer[options[correctIdx]] = false; newAns[qId].answer[options[wrongIdx]] = true; errorsMade++; } } } return newAns; }
        if (errorCount > 0) {
            answers = introduceErrors(answers, errorCount);
        }
        
        const tipoTarefa = is_expired ? "Expirada" : "Pendente";
        const submitPayload = { type: "submit", taskId, token, tipo: tipoTarefa, tempo: parseInt(tempo, 10), status: submission_type, accessed_on: "room", executed_on: room, answers };
        
        console.log(`[TAREFA ETAPA 2] A enviar payload final para o serviço externo.`);
        const submitResponse = await axios.post(API_URL, submitPayload);
        
        // LOG CRÍTICO: Vamos ver a resposta exata.
        console.log(`[RESPOSTA EXTERNA - TAREFA ${taskId}] Resposta recebida:`, JSON.stringify(submitResponse.data));

        res.status(200).json(submitResponse.data);

    } catch (error) {
        console.error(`[ERRO CRÍTICO - TAREFA ${taskId}]`, error.response ? error.response.data : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na comunicação com o serviço de tarefas. Detalhes: ${errorDetails}` });
    }
};
