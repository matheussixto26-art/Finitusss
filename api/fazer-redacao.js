const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Acessa a chave da API de forma segura a partir das Variáveis de Ambiente
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Função para extrair o objeto JSON de dentro de uma string
function extractJSONObject(str) {
    const startIndex = str.indexOf('(');
    const endIndex = str.lastIndexOf(')');
    if (startIndex !== -1 && endIndex !== -1) {
        return JSON.parse(str.substring(startIndex + 1, endIndex));
    }
    return null;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    // O frontend agora envia ra e senha, pois o novo serviço precisa deles
    const { taskId, token, room, submission_type, ra, senha } = req.body;
    if (!taskId || !token || !room || !submission_type || !ra || !senha) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }
    
    const PROXY_URL = "https://crimsonstrauss.xyz/eclipseprocess.php";

    try {
        // --- ETAPA 1: Autenticar no serviço de proxy ---
        console.log(`[REDAÇÃO ETAPA 1] Autenticando no proxy com o RA.`);
        const authResponse = await axios.post(`${PROXY_URL}?action=login_external_api`, { ra, senha });
        const proxyAuthToken = authResponse.data.token; // O tokenB/authToken é o mesmo
        const nick = authResponse.data.nick;

        // --- ETAPA 2: Obter a lista de redações disponíveis ---
        console.log(`[REDAÇÃO ETAPA 2] A obter a lista de redações.`);
        const fetchRedacoesResponse = await axios.post(`${PROXY_URL}?action=login_and_fetch_redacoes`, {
            ra: ra,
            authToken: proxyAuthToken,
            nick: nick
        });
        
        // A resposta vem como uma string "callback({...})", então extraímos o JSON
        const redacoesDisponiveis = extractJSONObject(fetchRedacoesResponse.data).redacoes;
        const targetRedaction = redacoesDisponiveis.find(r => r.id === taskId);

        if (!targetRedaction) {
            throw new Error(`Redação com ID ${taskId} não encontrada na sua lista.`);
        }

        // --- ETAPA 3: Obter o prompt detalhado da API oficial ---
        console.log(`[REDAÇÃO ETAPA 3] A obter prompt detalhado da API oficial.`);
         const taskDetailsResponse = await axios.get(
            `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room}`,
            { headers: { 'x-api-key': token } }
        );
        const taskData = taskDetailsResponse.data;
        const question = taskData.questions[0];

        // --- ETAPA 4: Construir o prompt e gerar texto com o Gemini ---
        console.log(`[REDAÇÃO ETAPA 4] A gerar texto com o Gemini.`);
        const promptParaGemini = `
            Escreva uma redação concisa com base estritamente nas informações e no enunciado fornecidos.
            Siga todas as instruções do enunciado à risca.
            A resposta DEVE ser APENAS no formato "TITULO: [Seu Título]\nTEXTO: [Seu Texto]", sem introduções, despedidas, ou qualquer outra palavra fora deste formato.

            INFORMAÇÕES:
            Título da Proposta: ${taskData.title}
            Descrição: ${taskData.description}
            Enunciado Completo: ${question.statement}
        `;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(promptParaGemini);
        const redacaoGerada = result.response.text();
        
        // --- ETAPA 5: Preparar o payload e submeter através do proxy ---
        console.log(`[REDAÇÃO ETAPA 5] A submeter redação através do proxy.`);
        
        // Extrair título e texto da resposta do Gemini
        const tituloMatch = redacaoGerada.match(/TITULO: (.*)/);
        const textoMatch = redacaoGerada.match(/TEXTO: ([\s\S]*)/);
        const titulo = tituloMatch ? tituloMatch[1] : "Redação Gerada";
        const texto = textoMatch ? textoMatch[1].trim() : "Não foi possível gerar o conteúdo.";
        
        // Injetar a redação gerada no objeto da redação que obtivemos na Etapa 2
        targetRedaction.answer_answers = {
            [question.id]: {
                answer: { body: texto, title: titulo },
                question_id: question.id,
                question_type: "essay",
            }
        };
        targetRedaction.answer_status = submission_type; // 'draft' ou 'submitted'

        const finalPayload = {
            redaction: targetRedaction,
            authToken: proxyAuthToken
        };

        const finalResponse = await axios.post(`${PROXY_URL}?action=process_redaction`, finalPayload);

        res.status(200).json({ success: true, message: "Operação de redação concluída!", data: finalResponse.data });

    } catch (error) {
        console.error("Erro ao fazer redação:", error.response ? JSON.stringify(error.response.data) : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ success: false, error: `Falha no processo de redação. Detalhes: ${errorDetails}` });
    }
};
