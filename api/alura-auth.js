const axios = require('axios');

module.exports = async (req, res) => {
    console.log("[ALURA-AUTH] Função iniciada.");
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { token } = req.body;
    if (!token) {
        console.error("[ALURA-AUTH] Erro: Token não foi fornecido no corpo da requisição.");
        return res.status(400).json({ error: 'Token é obrigatório.' });
    }
    
    const API_URL = "https://api.moonscripts.cloud/alura-auth";
    console.log(`[ALURA-AUTH] A tentar fazer POST para ${API_URL}`);

    try {
        const response = await axios.post(API_URL, { token });
        console.log("[ALURA-AUTH] Sucesso! Resposta recebida:", response.data);
        res.status(200).json(response.data);
    } catch (error) {
        console.error("[ALURA-AUTH] Ocorreu um erro CRÍTICO.");
        // Log detalhado do erro para depuração
        if (error.response) {
            console.error('[ALURA-AUTH] Erro de resposta do servidor:', {
                status: error.response.status,
                headers: error.response.headers,
                data: error.response.data,
            });
        } else if (error.request) {
            console.error('[ALURA-AUTH] Erro de requisição (sem resposta):', error.request);
        } else {
            console.error('[ALURA-AUTH] Erro na configuração do pedido:', error.message);
        }
        // Retorna um erro genérico para o frontend, mas os detalhes estão nos logs do servidor.
        res.status(500).json({ error: `Falha crítica na autenticação da Alura. Verifique os logs do servidor na Vercel para mais detalhes.` });
    }
};
