const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room, is_expired, answerId } = req.body;

    if (!taskId || !token || !room || !answerId) {
        return res.status(400).json({ error: 'Parâmetros em falta: taskId, token, room e answerId são obrigatórios.' });
    }

    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        // Para enviar um rascunho, não precisamos de "preview", pois as respostas já existem.
        // Vamos direto para a submissão.

        // O tipo muda se o rascunho for de uma tarefa já expirada.
        const tipoTarefa = is_expired ? "RascunhoExpirado" : "Rascunho";

        // O payload é quase o mesmo do "fazer-tarefa", mas sem as respostas e com o answerId
        const submitPayload = {
            type: "submit",
            taskId: taskId,
            token: token,
            tipo: tipoTarefa,
            tempo: 1, // O tempo não é relevante aqui, mas enviamos um valor
            status: "submitted",
            accessed_on: "room",
            executed_on: room,
            answerId: answerId // A chave secreta!
        };

        console.log(`A enviar rascunho para a tarefa ${taskId} com answerId ${answerId}`);
        const submitResponse = await axios.post(API_URL, submitPayload);

        if (submitResponse.data && (submitResponse.data.error || submitResponse.data.success === false)) {
             const errorMessage = submitResponse.data.message || submitResponse.data.error || 'Erro desconhecido retornado pelo servidor de tarefas.';
             return res.status(400).json({ error: errorMessage });
        }

        res.status(200).json({ success: true, message: "Rascunho enviado com sucesso!" });

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na comunicação com o serviço de tarefas. Detalhes: ${errorDetails}` });
    }
};
