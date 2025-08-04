const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Acessa a chave da API de forma segura a partir das Variáveis de Ambiente
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room } = req.body;
    if (!taskId || !token || !room) {
        return res.status(400).json({ error: 'Parâmetros em falta: taskId, token, room.' });
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
            Por favor, escreva uma carta aberta com base estritamente nas informações fornecidas.
            Siga todas as instruções do enunciado. Não adicione nenhuma informação que não esteja nos textos de apoio.
            A resposta deve ser APENAS no formato "TITULO: [Seu Título]\nTEXTO: [Seu Texto]", sem nenhuma outra palavra, formatação ou explicação.

            INFORMAÇÕES PARA A REDAÇÃO:
            Título da Proposta: ${taskData.title}
            Descrição: ${taskData.description}
            Enunciado Completo: ${question.statement}
        `;

        // --- ETAPA 3: Chamar a API do Gemini para gerar a redação ---
        console.log(`[REDAÇÃO ETAPA 3] A enviar prompt para a API do Gemini.`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(promptParaGemini);
        const geminiResponse = await result.response;
        const redacaoGerada = geminiResponse.text();
        
        console.log(`[REDAÇÃO ETAPA 3] Redação gerada com sucesso.`);

        // --- ETAPA 4: Submeter a redação gerada ---
        // Esta parte é baseada na lógica de submissão de tarefas normais.
        console.log(`[REDAÇÃO ETAPA 4] A submeter a redação gerada para a tarefa ${taskId}.`);
        const submitPayload = {
            answers: {
                [questionId]: {
                    question_id: questionId,
                    question_type: "essay",
                    answer: redacaoGerada
                }
            },
            status: 'draft', // Primeiro salva como rascunho
            duration: 120 // Simula 2 minutos
        };

        // Primeiro POST para salvar o rascunho
        await axios.post(
            `https://edusp-api.ip.tv/tms/task/${taskId}/answer`,
            submitPayload,
            { headers: { 'x-api-key': token, 'Content-Type': 'application/json' } }
        );
        
        // Segundo POST para submeter o rascunho
        submitPayload.status = 'submitted';
         const finalResponse = await axios.post(
            `https://edusp-api.ip.tv/tms/task/${taskId}/answer`,
            submitPayload,
            { headers: { 'x-api-key': token, 'Content-Type': 'application/json' } }
        );

        console.log(`[REDAÇÃO ETAPA 4] Redação submetida com sucesso.`);
        res.status(200).json({ success: true, message: "Redação enviada!", data: finalResponse.data });

    } catch (error) {
        console.error("Erro crítico ao fazer redação:", error.response ? error.response.data : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ success: false, error: `Falha no processo de redação. Detalhes: ${errorDetails}` });
    }
};
          
