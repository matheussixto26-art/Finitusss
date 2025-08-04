const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

        // --- ETAPA 3: Chamar a API do Gemini para gerar a redação ---
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(promptParaGemini);
        const geminiResponse = await result.response;

        // DIAGNÓSTICO AVANÇADO: Verificar se o Gemini realmente retornou texto.
        const redacaoGerada = geminiResponse.text();
        if (!redacaoGerada || redacaoGerada.trim() === '') {
            // Se o texto estiver vazio, vamos descobrir porquê.
            const finishReason = geminiResponse.candidates?.[0]?.finishReason || 'Não especificado';
            const safetyRatings = JSON.stringify(geminiResponse.promptFeedback?.safetyRatings || []);
            // Lança um erro detalhado que será mostrado no alerta do frontend.
            throw new Error(`O Gemini não gerou texto. Motivo do término: ${finishReason}. Classificações de Segurança: ${safetyRatings}`);
        }

        // --- ETAPA 4: Submeter a redação gerada ---
        const submitPayload = {
            answers: { [questionId]: { question_id: questionId, question_type: "essay", answer: redacaoGerada } },
            status: submission_type,
            duration: 180,
            accessed_on: "room",
            executed_on: room
        };

        const finalResponse = await axios.post(
            `https://edusp-api.ip.tv/tms/task/${taskId}/answer`,
            submitPayload,
            { headers: { 'x-api-key': token, 'Content-Type': 'application/json' } }
        );

        if (finalResponse.data && (finalResponse.data.error || finalResponse.data.success === false)) {
            const errorMessage = finalResponse.data.message || finalResponse.data.error || 'Erro desconhecido retornado pelo servidor de redações.';
            return res.status(400).json({ error: errorMessage });
        }

        res.status(200).json({ success: true, message: "Operação concluída!", data: finalResponse.data });

    } catch (error) {
        console.error("Erro ao fazer redação:", error.response ? JSON.stringify(error.response.data) : error.message);
        // O erro que criámos no diagnóstico avançado será enviado aqui.
        res.status(500).json({ success: false, error: `Falha no processo de redação. Detalhes: ${error.message}` });
    }
};
            
