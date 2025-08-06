const axios = require('axios');

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

// NOVO: Função para processar uma única tarefa e retornar o resultado
async function processSingleTask(task, allParams) {
    const { token, tempo, errorCount, submission_type } = allParams;
    const { taskId, room } = task;
    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        const previewResponse = await axios.post(API_URL, {
            type: "previewTask", taskId, room, token
        });
        
        let answers = previewResponse.data?.answers;
        if (!answers) {
            return { taskId, success: false, error: 'Não foi possível obter respostas.' };
        }

        if (errorCount > 0) {
            answers = introduceErrors(answers, errorCount);
        }
        
        const tipoTarefa = task.is_expired ? "Expirada" : "Pendente";
        const submitPayload = {
            type: "submit", taskId, token, tipo: tipoTarefa,
            tempo: parseFloat(tempo) || 1, status: submission_type,
            accessed_on: "room", executed_on: room, answers
        };
        
        const submitResponse = await axios.post(API_URL, submitPayload);
        
        if (submitResponse.data && (submitResponse.data.error || submitResponse.data.success === false)) {
            return { taskId, success: false, error: submitResponse.data.message || 'Erro retornado pelo serviço.' };
        }
        
        return { taskId, success: true };

    } catch (error) {
        let errorMessage = 'Falha na comunicação com o serviço externo.';
        if (error.response && error.response.headers['content-type']?.includes('text/html')) {
            errorMessage = 'O serviço externo de tarefas parece estar offline.';
        }
        return { taskId, success: false, error: errorMessage };
    }
}


module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    
    // Agora o backend recebe um array de tarefas
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'É necessário um array de tarefas.' });
    }

    const results = [];
    // Processa cada tarefa no array uma a uma
    for (const task of tasks) {
        const result = await processSingleTask(task, req.body);
        results.push(result);
    }

    res.status(200).json({ results });
};
        
