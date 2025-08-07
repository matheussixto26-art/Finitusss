const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { task, token } = req.body;
    if (!task || !token) {
        return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }
    
    const API_URL = "https://api.moonscripts.cloud/edusp";
    try {
        const previewResponse = await axios.post(API_URL, {
            type: "previewTask", taskId: task.id, room: task.publication_target, token
        });
        
        let answers = previewResponse.data?.answers;
        if (!answers) return res.status(500).json({ error: 'Serviço externo não retornou respostas.' });

        const submitPayload = {
            type: "submit", taskId: task.id, token, 
            tipo: task.task_expired ? "Expirada" : "Pendente",
            tempo: 60, status: "submitted",
            accessed_on: "room", executed_on: task.publication_target, answers
        };
        
        const submitResponse = await axios.post(API_URL, submitPayload);
        res.status(200).json(submitResponse.data);
    } catch (error) {
        let errorMessage = 'Falha na comunicação com o serviço externo.';
        if (error.response?.headers['content-type']?.includes('text/html')) {
            errorMessage = 'O serviço externo de tarefas parece estar offline.';
        }
        res.status(500).json({ error: errorMessage });
    }
};
