const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { taskId, token, room } = req.body;
    if (!taskId || !token || !room) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }

    try {
        // --- ETAPA DE DIAGNÓSTICO FINAL ---
        // Vamos buscar os detalhes da tarefa e devolvê-los para análise.
        console.log(`[DIAGNÓSTICO FINAL] A obter detalhes da tarefa ${taskId}`);
        const taskDetailsResponse = await axios.get(
            `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room}`,
            { headers: { 'x-api-key': token } }
        );
        const taskData = taskDetailsResponse.data;

        // Envia a estrutura completa da tarefa para o frontend.
        const taskStructure = JSON.stringify(taskData);
        return res.status(400).json({ 
            error: `DIAGNÓSTICO FINAL: Copie e cole a estrutura completa que está dentro dos parênteses: (${taskStructure})`
        });

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha no processo de diagnóstico. Detalhes: ${errorDetails}` });
    }
};
