const axios = require('axios');

function introduceErrors(answers, errorCount) {
    if (errorCount <= 0) return answers;
    const newAnswers = JSON.parse(JSON.stringify(answers));
    const questionIds = Object.keys(newAnswers);
    let errorsMade = 0;
    for (const qId of questionIds) {
        if (errorsMade >= errorCount) break;
        const question = newAnswers[qId];
        const correctAnswer = question.answer;
        let madeError = false;
        if (typeof correctAnswer === 'object' && correctAnswer !== null) {
            const options = Object.keys(correctAnswer);
            const correctIndex = options.findIndex(k => correctAnswer[k] === true);
            if (correctIndex !== -1) {
                const wrongIndex = options.findIndex(k => correctAnswer[k] === false);
                if (wrongIndex !== -1) {
                    correctAnswer[options[correctIndex]] = false;
                    correctAnswer[options[wrongIndex]] = true;
                    madeError = true;
                }
            }
        }
        if (madeError) errorsMade++;
    }
    return newAnswers;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { taskId, token, room, tempo, is_expired, submission_type, errorCount } = req.body;
    if (!taskId || !token || !room || !tempo || !submission_type) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }
    const API_URL = "https://api.moonscripts.cloud/edusp";
    try {
        const previewResponse = await axios.post(API_URL, {
            type: "previewTask", taskId, room, token
        });
        let answers = previewResponse.data?.answers;
        if (!answers) {
            return res.status(500).json({ error: 'Não foi possível obter as respostas da tarefa (Fase 1).' });
        }
        if (errorCount > 0) {
            answers = introduceErrors(answers, errorCount);
        }
        const tipoTarefa = is_expired ? "Expirada" : "Pendente";
        const submitPayload = {
            type: "submit", taskId, token, tipo: tipoTarefa,
            tempo: parseInt(tempo, 10), status: submission_type,
            accessed_on: "room", executed_on: room, answers
        };
        const submitResponse = await axios.post(API_URL, submitPayload);
        
        const responseData = submitResponse.data;
        if (responseData && (responseData.error || responseData.success === false)) {
             const errorMessage = responseData.message || responseData.error || 'Erro desconhecido retornado pelo servidor.';
             return res.status(400).json({ error: errorMessage });
        }
        
        res.status(200).json(responseData);
    } catch (error) {
        // DETEÇÃO INTELIGENTE DE ERRO
        if (error.response && typeof error.response.data === 'string' && error.response.data.includes('Cloudflare')) {
            return res.status(502).json({ error: 'O serviço de tarefas (moonscripts) parece estar offline ou com problemas. Por favor, tente novamente mais tarde.' });
        }
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na comunicação. Detalhes: ${errorDetails}` });
    }
};
