const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function extractJSONObject(str) { try { const startIndex = str.indexOf('('); const endIndex = str.lastIndexOf(')'); if (startIndex !== -1 && endIndex !== -1) { return JSON.parse(str.substring(startIndex + 1, endIndex)); } return null; } catch { return null; } }

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { taskId, token, room, submission_type, ra, senha } = req.body;
    console.log(`[REDAÇÃO INICIADA] ID: ${taskId}, Ação: ${submission_type}`);
    
    const PROXY_URL = "https://crimsonstrauss.xyz/eclipseprocess.php";

    try {
        console.log(`[REDAÇÃO ETAPA 1] A autenticar no proxy com o RA.`);
        const authResponse = await axios.post(`${PROXY_URL}?action=login_external_api`, { ra, senha });
        const proxyAuthToken = authResponse.data.token;
        const nick = authResponse.data.nick;

        console.log(`[REDAÇÃO ETAPA 2] A obter a lista de redações.`);
        const fetchRedacoesResponse = await axios.post(`${PROXY_URL}?action=login_and_fetch_redacoes`, { ra: ra, authToken: proxyAuthToken, nick: nick });
        
        const redacoesData = extractJSONObject(fetchRedacoesResponse.data);
        if (!redacoesData || !redacoesData.redacoes) throw new Error("A resposta da lista de redações é inválida.");
        const targetRedaction = redacoesData.redacoes.find(r => r.id === taskId);
        if (!targetRedaction) throw new Error(`Redação com ID ${taskId} não encontrada.`);

        console.log(`[REDAÇÃO ETAPA 3] A obter prompt detalhado da API oficial.`);
        const taskDetailsResponse = await axios.get(`https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room}`, { headers: { 'x-api-key': token } });
        const taskData = taskDetailsResponse.data;
        const question = taskData.questions[0];
        
        console.log(`[REDAÇÃO ETAPA 4] A gerar texto com o Gemini.`);
        const promptParaGemini = `Escreva uma redação concisa com base estritamente nas informações e no enunciado fornecidos. Siga todas as instruções do enunciado à risca. A resposta DEVE ser APENAS no formato "TITULO: [Seu Título]\nTEXTO: [Seu Texto]", sem introduções, despedidas, ou qualquer outra palavra fora deste formato. INFORMAÇÕES: Título da Proposta: ${taskData.title} Descrição: ${taskData.description} Enunciado Completo: ${question.statement}`;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(promptParaGemini);
        const redacaoGerada = result.response.text();
        
        const tituloMatch = redacaoGerada.match(/TITULO: (.*)/);
        const textoMatch = redacaoGerada.match(/TEXTO: ([\s\S]*)/);
        const titulo = tituloMatch ? tituloMatch[1] : "Redação Gerada";
        const texto = textoMatch ? textoMatch[1].trim() : "Conteúdo não gerado.";
        
        targetRedaction.answer_answers = { [question.id]: { answer: { body: texto, title: titulo }, question_id: question.id, question_type: "essay" } };
        targetRedaction.answer_status = submission_type;

        console.log(`[REDAÇÃO ETAPA 5] A submeter redação através do proxy.`);
        const finalPayload = { redaction: targetRedaction, authToken: proxyAuthToken };
        const finalResponse = await axios.post(`${PROXY_URL}?action=process_redaction`, finalPayload);
        
        console.log(`[RESPOSTA EXTERNA - REDAÇÃO ${taskId}] Resposta recebida:`, JSON.stringify(finalResponse.data));

        res.status(200).json({ success: true, message: "Operação de redação concluída!", data: finalResponse.data });

    } catch (error) {
        console.error(`[ERRO CRÍTICO - REDAÇÃO ${taskId}]`, error.response ? error.response.data : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ success: false, error: `Falha no processo de redação. Detalhes: ${errorDetails}` });
    }
};
