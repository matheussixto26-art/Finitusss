const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room } = req.body;
    if (!taskId || !token || !room) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }

    try {
        // --- ETAPA 1: Obter os detalhes da redação ---
        const taskDetailsResponse = await axios.get(
            `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room}`,
            { headers: { 'x-api-key': token } }
        );
        
        const taskData = taskDetailsResponse.data;
        const question = taskData.questions[0];
        const questionId = question.id;

        // --- ETAPA 2: Construir o prompt para o Gemini ---
        const promptParaGemini = `
            Escreva uma carta aberta concisa com base estritamente nas informações e no enunciado fornecidos.
            Siga todas as instruções do enunciado à risca.
            A resposta DEVE ser APENAS no formato "TITULO: [Seu Título]\nTEXTO: [Seu Texto]", sem introduções, despedidas, ou qualquer outra palavra fora deste formato.

            INFORMAÇÕES PARA A REDAÇÃO:
            Título da Proposta: ${taskData.title}
            Descrição: ${taskData.description}
            Enunciado Completo: ${question.statement}
        `;

        // --- ETAPA 3: Chamar o Gemini para gerar a redação ---
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(promptParaGemini);
        const redacaoGerada = result.response.text();

        // --- ETAPA 4: Salvar a redação como RASCUNHO ---
        const saveDraftPayload = {
            answers: {
                [questionId]: {
                    question_id: questionId,
                    question_type: "essay",
                    answer: redacaoGerada
                }
            },
            status: 'draft', // ALTERAÇÃO PRINCIPAL AQUI
            duration: 180 // Simula 3 minutos
        };

        const finalResponse = await axios.post(
            `https://edusp-api.ip.tv/tms/task/${taskId}/answer`,
            saveDraftPayload,
            { headers: { 'x-api-key': token, 'Content-Type': 'application/json' } }
        );

        res.status(200).json({ success: true, message: "Rascunho da redação salvo!", data: finalResponse.data });

    } catch (error) {
        console.error("Erro ao fazer redação:", error.response ? JSON.stringify(error.response.data) : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ success: false, error: `Falha no processo de redação. Detalhes: ${errorDetails}` });
    }
};
            
