const axios = require('axios');

// Esta função permanece a mesma
function introduceErrors(answers, errorCount) {
    if (errorCount <= 0) return answers;
    const newAnswers = JSON.parse(JSON.stringify(answers));
    const questionIds = Object.keys(newAnswers);
    let errorsMade = 0;
    for (const qId of questionIds) {
        if (errorsMade >= errorCount) break;
        const question = newAnswers[qId];
        if (typeof question.answer === 'object' && question.answer !== null) {
            const options = Object.keys(question.answer);
            const correctIndex = options.findIndex(k => question.answer[k] === true);
            if (correctIndex > -1) {
                const wrongIndex = options.findIndex(k => question.answer[k] === false);
                if (wrongIndex > -1) {
                    question.answer[options[correctIndex]] = false;
                    question.answer[options[wrongIndex]] = true;
                    errorsMade++;
                }
            }
        }
    }
    return newAnswers;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    
    // Agora o backend pode receber uma ou várias tarefas
    const { tasks, token, tempo, errorCount, submission_type } = req.body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0 || !token || !submission_type) {
        return res.status(400).json({ error: 'Parâmetros inválidos. É necessário um array de tarefas.' });
    }

    const API_URL = "https://api.moonscripts.cloud/edusp";
    const results = [];

    // Processa cada tarefa individualmente
    for (const task of tasks) {
        try {
            const { taskId, room, is_expired } = task;

            const previewResponse = await axios.post(API_URL, {
                type: "previewTask", taskId, room, token
            });
            
            let answers = previewResponse.data?.answers;
            if (!answers) {
                results.push({ taskId, success: false, error: 'Não foi possível obter respostas.' });
                continue; // Pula para a próxima tarefa
            }

            if (errorCount > 0) {
                answers = introduceErrors(answers, errorCount);
            }
            
            const tipoTarefa = is_expired ? "Expirada" : "Pendente";
            const submitPayload = {
                type: "submit", taskId, token, tipo: tipoTarefa,
                tempo: parseFloat(tempo) || 1, status: submission_type,
                accessed_on: "room", executed_on: room, answers
            };
            
            const submitResponse = await axios.post(API_URL, submitPayload);
            
            if (submitResponse.data && (submitResponse.data.error || submitResponse.data.success === false)) {
                results.push({ taskId, success: false, error: submitResponse.data.message || 'Erro retornado pelo serviço.' });
            } else {
                results.push({ taskId, success: true });
            }

        } catch (error) {
            let errorMessage = 'Falha na comunicação com o serviço externo.';
            if (error.response && error.response.headers['content-type']?.includes('text/html')) {
                errorMessage = 'O serviço externo de tarefas parece estar offline.';
            }
            results.push({ taskId: task.taskId, success: false, error: errorMessage });
        }
    }

    res.status(200).json({ results });
};
                
