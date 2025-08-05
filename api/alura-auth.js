const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    
    const { tokenA } = req.body;
    if (!tokenA) {
        return res.status(400).json({ error: 'Token de identidade (tokenA) é obrigatório.' });
    }
    
    const aluraSsoUrl = `https://cursos.alura.com.br/seducLogin?token=${tokenA}&clientToken=40f949bf2e01f5750d9ba7a008c37262ce1adb83caf321c8bacdd38c4a204315`;

    try {
        console.log(`[ALURA-AUTH] A tentar fazer SSO para a Alura.`);
        
        // Fazemos o pedido e esperamos uma resposta (incluindo 3xx)
        const response = await axios.get(aluraSsoUrl, {
            httpsAgent: agent,
            maxRedirects: 0, // Não seguir redirecionamentos para podermos ver os headers
            validateStatus: status => status >= 200 && status < 400 // Aceita 2xx e 3xx como "sucesso"
        });

        // A LÓGICA AGORA ESTÁ AQUI, NO FLUXO DE SUCESSO
        const cookies = response.headers['set-cookie'];

        if (!cookies || cookies.length === 0) {
            // Se o servidor respondeu OK mas não enviou cookies, é um erro de lógica inesperado.
            throw new Error('A resposta de autenticação da Alura foi bem-sucedida, mas não retornou os cookies necessários.');
        }
        
        const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
        console.log("[ALURA-AUTH] Cookies de sessão obtidos com sucesso.");
        
        return res.status(200).json({ success: true, cookies: cookieString });

    } catch (error) {
        // O bloco catch agora lida apenas com erros genuínos (falhas de rede, 4xx, 5xx)
        const errorDetails = error.response ? `Status ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
        console.error(`[ALURA-AUTH] Erro inesperado:`, errorDetails);
        res.status(500).json({ error: `Falha na autenticação SSO da Alura. Detalhes: ${errorDetails}` });
    }
};
