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

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    // Recebe os novos parâmetros do frontend
    const { taskId, token, room, tempo, is_expired, submission_type, errorCount } = req.body;
    if (!taskId || !token || !room || !submission_type) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }
    
    const API_URL = "https://api.moonscripts.cloud/edusp";

    try {
        const previewResponse = await axios.post(API_URL, {
            type: "previewTask", taskId, room, token
        });
        
        let answers = previewResponse.data?.answers;
        if (!answers) {
            return res.status(500).json({ error: 'O serviço externo não retornou as respostas da tarefa.' });
        }

        // Usa o novo parâmetro de contagem de erros
        if (errorCount > 0) {
            answers = introduceErrors(answers, errorCount);
        }
        
        const tipoTarefa = is_expired ? "Expirada" : "Pendente";
        const submitPayload = {
            type: "submit", taskId, token, tipo: tipoTarefa,
            tempo: parseFloat(tempo) || 1, // Usa o tempo enviado pelo utilizador
            status: submission_type,
            accessed_on: "room", executed_on: room, answers
        };
        
        const submitResponse = await axios.post(API_URL, submitPayload);
        const responseData = submitResponse.data;

        if (responseData && (responseData.error || responseData.success === false)) {
             const errorMessage = responseData.message || responseData.error || 'Erro desconhecido retornado pelo serviço externo.';
             return res.status(400).json({ error: errorMessage });
        }
        
        res.status(200).json(responseData);

    } catch (error) {
        if (error.response && error.response.headers['content-type']?.includes('text/html')) {
            return res.status(502).json({ error: 'O serviço externo de tarefas parece estar offline ou com problemas. Por favor, tente novamente mais tarde.' });
        }
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na comunicação com o serviço de tarefas. Detalhes: ${errorDetails}` });
    }
};
