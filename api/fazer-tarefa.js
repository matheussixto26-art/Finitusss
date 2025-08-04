const axios = require('axios');

function introduceErrors(answers, errorCount, questions) {
    if (errorCount <= 0) return answers;
    const newAnswers = JSON.parse(JSON.stringify(answers));
    const questionIds = Object.keys(newAnswers);
    let errorsMade = 0;

    for (const qId of questionIds) {
        if (errorsMade >= errorCount) break;

        const questionData = questions.find(q => q.id.toString() === qId);
        if (!questionData || !questionData.options) continue; // Pula se não for uma questão de múltipla escolha

        const correctAnswer = newAnswers[qId].answer;
        let madeError = false;

        if (typeof correctAnswer === 'object' && correctAnswer !== null) {
            const options = questionData.options;
            const correctOption = options.find(opt => opt.is_correct);
            const wrongOption = options.find(opt => !opt.is_correct);

            if (correctOption && wrongOption) {
                // Altera a resposta para uma opção incorreta
                delete newAnswers[qId].answer[correctOption.id];
                newAnswers[qId].answer[wrongOption.id] = true;
                madeError = true;
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
    if (!taskId || !token || !room || !submission_type) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }

    try {
        // --- ETAPA 1: Abrir a tarefa e pegar o "gabarito" ---
        console.log(`[ETAPA 1] A obter detalhes e respostas para a tarefa ${taskId}`);
        const taskDetailsResponse = await axios.get(
            `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room}`,
            { headers: { 'x-api-key': token } }
        );
        const taskData = taskDetailsResponse.data;
        if (!taskData || !taskData.questions) {
            throw new Error('Não foi possível obter os detalhes das questões da tarefa.');
        }

        // --- ETAPA 2: Extrair as respostas corretas ---
        console.log(`[ETAPA 2] A extrair as respostas corretas.`);
        let correctAnswersPayload = {};
        taskData.questions.forEach(q => {
            // A API oficial já fornece a resposta no formato que precisamos para enviar
            if (q.answer) {
                 correctAnswersPayload[q.id] = {
                    question_id: q.id,
                    question_type: q.type,
                    answer: q.answer
                };
            }
        });

        // --- ETAPA 3: Introduzir erros, se solicitado ---
        let finalAnswers = correctAnswersPayload;
        if (errorCount > 0) {
            console.log(`[ETAPA 3] A introduzir ${errorCount} erro(s).`);
            finalAnswers = introduceErrors(correctAnswersPayload, errorCount, taskData.questions);
        }

        // --- ETAPA 4: Montar e enviar a tarefa ---
        console.log(`[ETAPA 4] A enviar a tarefa ${taskId} com status '${submission_type}'.`);
        const submitPayload = {
            answers: finalAnswers,
            status: submission_type, // 'draft' ou 'submitted'
            duration: parseInt(tempo, 10),
            accessed_on: "room",
            executed_on: room
        };

        const finalResponse = await axios.post(
            `https://edusp-api.ip.tv/tms/task/${taskId}/answer`,
            submitPayload,
            { headers: { 'x-api-key': token, 'Content-Type': 'application/json' } }
        );
        
        // Verificação contra "Falsos Positivos"
        if (finalResponse.data && (finalResponse.data.error || finalResponse.data.success === false)) {
            const errorMessage = finalResponse.data.message || finalResponse.data.error || 'Erro desconhecido retornado pelo servidor.';
            return res.status(400).json({ error: errorMessage });
        }

        res.status(200).json({ success: true, message: "Operação concluída com sucesso!", data: finalResponse.data });

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha no processo da tarefa. Detalhes: ${errorDetails}` });
    }
};
    
