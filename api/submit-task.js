const axios = require('axios');

module.exports = async (req, res) => {
    console.log("--- INICIANDO NOSSO PRÓPRIO SUBMIT-TASK ---");

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    
    // Recebemos os dados do nosso frontend (diagnostico.html)
    const { taskId, tokenB, payload } = req.body;
    
    if (!taskId || !tokenB || !payload) {
        return res.status(400).json({ error: 'Payload de submissão inválido. Faltam taskId, tokenB ou payload.' });
    }

    // Construímos a URL oficial que descobrimos
    const submitUrl = `https://edusp-api.ip.tv/tms/task/${taskId}/answer`;
    console.log("URL de submissão oficial:", submitUrl);

    // Montamos os headers exatamente como os que capturaste
    const headers = {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'x-api-realm': 'edusp',
        'x-api-platform': 'webclient',
        'x-api-key': tokenB, // O nosso Token B
        'origin': 'https://saladofuturo.educacao.sp.gov.br',
        'referer': 'https://saladofuturo.educacao.sp.gov.br/'
    };
    console.log("Headers que serão enviados:", { 'x-api-key': headers['x-api-key'].substring(0,20)+'...', ...headers });
    
    try {
        console.log("Enviando payload para a API oficial:", payload);
        const submitResponse = await axios.post(submitUrl, payload, { headers });
        
        console.log("Resposta recebida da API oficial:", submitResponse.data);
        res.status(200).json(submitResponse.data);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("Falha ao submeter a tarefa para a API oficial:", errorDetails);
        res.status(error.response?.status || 500).json({ 
            error: `Falha ao submeter a tarefa para a API oficial.`, 
            details: error.response?.data || error.message
        });
    }
};
