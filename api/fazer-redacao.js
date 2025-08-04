const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Acessa a chave da API de forma segura a partir das Variáveis de Ambiente
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room, submission_type } = req.body;
    if (!taskId || !token || !room || !submission_type) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }

    try {
        // --- ETAPA 1: Obter os detalhes da redação (tema, textos de apoio, etc.) ---
        console.log(`[REDAÇÃO ETAPA 1] A obter detalhes da tarefa ${taskId}`);
        const taskDetailsResponse = await axios.get(
            `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room}`,
            { headers: { 'x-api-key': token } }
        );
        
        const taskData = taskDetailsResponse.data;
        const question = taskData.questions[0]; // Redações geralmente têm apenas uma "pergunta"
        const questionId = question.id;

        // --- ETAPA 2: Construir o prompt para o Gemini ---
        console.log(`[REDAÇÃO ETAPA 2] A construir prompt para o Gemini.`);
        const promptParaGemini = `
            Escreva uma carta aberta concisa com base estritamente nas informações e no enunciado fornecidos.
            Siga todas as instruções do enunciado à risca.
            A resposta DEVE ser APENAS no formato "TITULO: [Seu Título]\nTEXTO: [Seu Texto]", sem introduções, despedidas, ou qualquer outra palavra fora deste formato.

            INFORMAÇÕES PARA A REDAÇÃO:
            Título da Proposta: ${taskData.title}
            Descrição: ${taskData.description}
            Enunciado Completo: ${question.statement}
        `;

        // --- ETAPA 3: Chamar a API do Gemini para gerar a redação ---
        console.log(`[REDAÇÃO ETAPA 3] A enviar prompt para a API do Gemini.`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(promptParaGemini);
        const redacaoGerada = result.response.text();
        
        console.log(`[REDAÇÃO ETAPA 3] Redação gerada com sucesso.`);

        // --- ETAPA 4: Submeter a redação gerada ---
        console.log(`[REDAÇÃO ETAPA 4] A submeter a redação para a tarefa ${taskId} com status '${submission_type}'.`);
        const submitPayload = {
            answers: {
                [questionId]: {
                    question_id: questionId,
                    question_type: "essay",
                    answer: redacaoGerada
                }
            },
            status: submission_type, // 'draft' ou 'submitted'
            duration: 180, // Simula 3 minutos
            accessed_on: "room",
            executed_on: room
        };

        const finalResponse = await axios.post(
            `https://edusp-api.ip.tv/tms/task/${taskId}/answer`,
            submitPayload,
            { headers: { 'x-api-key': token, 'Content-Type': 'application/json' } }
        );
        
        // Verificação Robusta contra "Falsos Positivos"
        if (finalResponse.data && (finalResponse.data.error || finalResponse.data.success === false)) {
            console.error("[ERRO SUBMISSÃO REDAÇÃO] O servidor retornou um erro interno:", finalResponse.data);
            const errorMessage = finalResponse.data.message || finalResponse.data.error || 'Erro desconhecido retornado pelo servidor de redações.';
            return res.status(400).json({ error: errorMessage });
        }

        console.log(`[REDAÇÃO ETAPA 4] Redação submetida com sucesso.`);
        res.status(200).json({ success: true, message: "Operação concluída!", data: finalResponse.data });

    } catch (error) {
        console.error("Erro crítico ao fazer redação:", error.response ? JSON.stringify(error.response.data) : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ success: false, error: `Falha no processo de redação. Detalhes: ${errorDetails}` });
    }
};
    
