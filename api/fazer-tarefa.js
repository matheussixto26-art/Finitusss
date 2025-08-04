const axios = require('axios');

function introduceErrors(answers, errorCount, questions) {
    if (errorCount <= 0) return answers;

    const newAnswers = JSON.parse(JSON.stringify(answers));
    const questionIds = Object.keys(newAnswers);
    let errorsMade = 0;

    for (const qId of questionIds) {
        if (errorsMade >= errorCount) break;

        const questionData = questions.find(q => q.id.toString() === qId);
        if (!questionData || !questionData.options) continue;

        let madeError = false;
        const currentAnswer = newAnswers[qId].answer;

        if (typeof currentAnswer === 'object' && currentAnswer !== null) {
            const correctOption = questionData.options.find(opt => opt.is_correct);
            const wrongOption = questionData.options.find(opt => !opt.is_correct);

            if (correctOption && wrongOption) {
                // Remove a chave da resposta correta e adiciona a da incorreta
                delete currentAnswer[correctOption.id];
                currentAnswer[wrongOption.id] = true;
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
        // ETAPA 1: Abrir a tarefa e pegar os detalhes completos
        const taskDetailsResponse = await axios.get(
            `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room}`,
            { headers: { 'x-api-key': token } }
        );
        const taskData = taskDetailsResponse.data;
        if (!taskData || !taskData.questions) {
            throw new Error('Não foi possível obter os detalhes das questões da tarefa.');
        }

        // ETAPA 2: Extrair o gabarito com a LÓGICA UNIFICADA E FINAL
        console.log(`[ETAPA 2] A extrair respostas com lógica para múltiplos tipos de tarefa.`);
        let correctAnswers = {};
        taskData.questions.forEach(question => {
            // Tenta o método 1: A resposta está diretamente no objeto da questão (ex: preencher lacunas)
            if (question.answer) {
                correctAnswers[question.id] = {
                    question_id: question.id,
                    question_type: question.type,
                    answer: question.answer
                };
            // Se não, tenta o método 2: A resposta precisa ser construída a partir das opções (ex: múltipla escolha)
            } else if (question.options && Array.isArray(question.options)) {
                const answerForQuestion = {};
                question.options.forEach(option => {
                    answerForQuestion[option.id] = option.is_correct;
                });
                if (Object.keys(answerForQuestion).length > 0) {
                    correctAnswers[question.id] = {
                        question_id: question.id,
                        question_type: question.type,
                        answer: answerForQuestion
                    };
                }
            }
        });

        if (Object.keys(correctAnswers).length === 0) {
            throw new Error("Não foi possível extrair nenhuma resposta da tarefa. Tipo de tarefa desconhecido ou sem gabarito.");
        }

        // ETAPA 3: Introduzir erros, se solicitado
        let finalAnswers = introduceErrors(correctAnswers, errorCount, taskData.questions);

        // ETAPA 4: Montar e enviar a tarefa
        const submitPayload = {
            answers: finalAnswers,
            status: submission_type,
            duration: parseInt(tempo, 10) || 60,
            accessed_on: "room",
            executed_on: room
        };

        const finalResponse = await axios.post(
            `https://edusp-api.ip.tv/tms/task/${taskId}/answer`,
            submitPayload,
            { headers: { 'x-api-key': token, 'Content-Type': 'application/json' } }
        );
        
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
                                           
