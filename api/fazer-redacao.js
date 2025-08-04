const axios = require('axios');
const https = require('https');

// Agente para ignorar erros de certificado
const agent = new https.Agent({
  rejectUnauthorized: false
});

const proxyHeaders = {
    'Origin': 'https://crimsonstrauss.xyz',
    'Referer': 'https://crimsonstrauss.xyz/redacao'
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { token, ra, senha } = req.body;
    if (!token || !ra || !senha) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }
    
    const PROXY_URL = "https://crimsonstrauss.xyz/eclipseprocess.php";

    try {
        // ETAPA 1: Autenticar no serviço de proxy
        const authResponse = await axios.post(`${PROXY_URL}?action=login_external_api`, { ra, senha }, { httpsAgent: agent, headers: proxyHeaders });
        const nick = authResponse.data.nick;
        if (!nick) throw new Error("Falha ao obter o nick na autenticação do proxy.");

        // ETAPA 2 (DIAGNÓSTICO): Obter a lista de redações e devolver a resposta bruta
        console.log(`[DIAGNÓSTICO REDAÇÃO] A obter a lista de redações.`);
        const fetchRedacoesResponse = await axios.post(`${PROXY_URL}?action=login_and_fetch_redacoes`, {
            ra: ra,
            authToken: token,
            nick: nick
        }, { httpsAgent: agent, headers: proxyHeaders });
        
        const rawResponse = JSON.stringify(fetchRedacoesResponse.data);
        return res.status(400).json({
            error: `DIAGNÓSTICO REDAÇÃO: O servidor respondeu o seguinte à nossa lista de redações. Por favor, copie e cole a resposta completa que está dentro dos parênteses: (${rawResponse})`
        });

    } catch (error) {
        console.error("Erro no diagnóstico de redação:", error.response ? JSON.stringify(error.response.data) : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ success: false, error: `Falha no processo de diagnóstico. Detalhes: ${errorDetails}` });
    }
};
