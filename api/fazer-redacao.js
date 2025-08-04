const axios = require('axios');
const https = require('https');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const agent = new https.Agent({
  rejectUnauthorized: false
});

const proxyHeaders = {
    'Origin': 'https://crimsonstrauss.xyz',
    'Referer': 'https://crimsonstrauss.xyz/redacao'
};

// Função de extração de JSON mais robusta
function extractJSONObject(str) {
    if (typeof str !== 'string') return str; // Se já for um objeto, retorna-o
    try {
        const startIndex = str.indexOf('(');
        const endIndex = str.lastIndexOf(')');
        if (startIndex !== -1 && endIndex !== -1) {
            return JSON.parse(str.substring(startIndex + 1, endIndex));
        }
        return JSON.parse(str);
    } catch {
        return null;
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, token, room, submission_type, ra, senha } = req.body;
    if (!taskId || !token || !room || !submission_type || !ra || !senha) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }
    
    const PROXY_URL = "https://crimsonstrauss.xyz/eclipseprocess.php";

    try {
        // ETAPA 1: Autenticar no serviço de proxy
        const authResponse = await axios.post(`${PROXY_URL}?action=login_external_api`, { ra, senha }, { httpsAgent: agent, headers: proxyHeaders });
        const nick = authResponse.data.nick;
        if (!nick) throw new Error("Falha ao obter o nick na autenticação do proxy.");

        // ETAPA 2: Obter a lista de redações
        const fetchRedacoesResponse = await axios.post(`${PROXY_URL}?action=login_and_fetch_redacoes`, {
            ra: ra,
            authToken: token,
            nick: nick
        }, { httpsAgent: agent, headers: proxyHeaders });
        
        const redacoesData = extractJSONObject(fetchRedacoesResponse.data);
        if (!redacoesData || !Array.isArray(redacoesData.redacoes)) {
            throw new Error("A resposta da lista de redações é inválida ou não contém um array 'redacoes'.");
        }
        const targetRedaction = redacoesData.redacoes.find(r => r.id === taskId);
        if (!targetRedaction) throw new Error(`Redação com ID ${taskId} não encontrada na sua lista.`);

        // ETAPA 3: Obter o prompt detalhado da API oficial
         const taskDetailsResponse = await axios.get(
            `https://edusp-api.ip.tv/tms/task/${taskId}/apply?preview_mode=false&room_name=${room}`,
            { headers: { 'x-api-key': token } }
        );
        const taskData = taskDetailsResponse.data;
        const question = taskData.questions[0];

        // ETAPA 4: Gerar texto com o Gemini
        const promptParaGemini = `Escreva uma redação concisa com base estritamente nas informações e no enunciado fornecidos. Siga todas as instruções do enunciado à risca. A resposta DEVE ser APENAS no formato "TITULO: [Seu Título]\nTEXTO: [Seu Texto]", sem introduções, despedidas, ou qualquer outra palavra fora deste formato. INFORMAÇÕES: Título da Proposta: ${taskData.title} Descrição: ${taskData.description} Enunciado Completo: ${question.statement}`;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(promptParaGemini);
        const redacaoGerada = result.response.text();
        
        const tituloMatch = redacaoGerada.match(/TITULO: (.*)/);
        const textoMatch = redacaoGerada.match(/TEXTO: ([\s\S]*)/);
        const titulo = tituloMatch ? tituloMatch[1] : "Redação Gerada Automaticamente";
        const texto = textoMatch ? textoMatch[1].trim() : "O conteúdo da redação não pôde ser gerado.";
        
        // ETAPA 5: Injetar a redação gerada e submeter através do proxy
        targetRedaction.answer_answers = { [question.id]: { answer: { body: texto, title: titulo }, question_id: question.id, question_type: "essay" } };
        targetRedaction.answer_status = submission_type;

        const finalPayload = {
            redaction: targetRedaction,
            authToken: token
        };

        const finalResponse = await axios.post(`${PROXY_URL}?action=process_redaction`, finalPayload, { httpsAgent: agent, headers: proxyHeaders });

        res.status(200).json({ success: true, message: "Operação de redação concluída!", data: finalResponse.data });

    } catch (error) {
        console.error("Erro ao fazer redação:", error.response ? JSON.stringify(error.response.data) : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ success: false, error: `Falha no processo de redação. Detalhes: ${errorDetails}` });
    }
};
