const axios = require('axios');

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
            return res.status(500).json({ error: 'O serviço externo não retornou as respostas da tarefa.' });
        }

        // A lógica de errar questões continua funcional
        function introduceErrors(ans, count) {
            if (count <= 0) return ans;
            const newAns = JSON.parse(JSON.stringify(ans));
            const qIds = Object.keys(newAns);
            let errorsMade = 0;
            for (const qId of qIds) {
                if (errorsMade >= count) break;
                const options = Object.keys(newAns[qId].answer);
                const correctIdx = options.findIndex(k => newAns[qId].answer[k] === true);
                if (correctIdx > -1) {
                    const wrongIdx = options.findIndex(k => newAns[qId].answer[k] === false);
                    if (wrongIdx > -1) {
                        newAns[qId].answer[options[correctIdx]] = false;
                        newAns[qId].answer[options[wrongIdx]] = true;
                        errorsMade++;
                    }
                }
            }
            return newAns;
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
             const errorMessage = responseData.message || responseData.error || 'Erro desconhecido retornado pelo serviço externo.';
             return res.status(400).json({ error: errorMessage });
        }
        
        res.status(200).json(responseData);

    } catch (error) {
        // VERIFICAÇÃO ROBUSTA DE ERRO OFFLINE
        if (error.response && error.response.headers['content-type']?.includes('text/html')) {
            return res.status(502).json({ error: 'O serviço externo de tarefas parece estar offline ou com problemas. Por favor, tente novamente mais tarde.' });
        }
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na comunicação com o serviço de tarefas. Detalhes: ${errorDetails}` });
    }
};
