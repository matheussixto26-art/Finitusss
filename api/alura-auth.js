const axios = require('axios');
const https = require('https');

// Agente para ignorar erros de certificado (pode ser necessário para o SSO)
const agent = new https.Agent({
  rejectUnauthorized: false
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    
    // CORREÇÃO: Esperar por 'tokenA' em vez de 'token'
    const { tokenA } = req.body;
    if (!tokenA) {
        return res.status(400).json({ error: 'Token de identidade (tokenA) é obrigatório.' });
    }
    
    const aluraSsoUrl = `https://cursos.alura.com.br/seducLogin?token=${tokenA}&clientToken=40f949bf2e01f5750d9ba7a008c37262ce1adb83caf321c8bacdd38c4a204315`;

    try {
        console.log(`[ALURA-AUTH] A tentar fazer SSO para: ${aluraSsoUrl}`);
        
        // Fazemos o pedido GET para o URL de SSO da Alura
        const response = await axios.get(aluraSsoUrl, {
            httpsAgent: agent,
            maxRedirects: 0, // Importante para capturar os cookies do primeiro redirecionamento
            validateStatus: status => status >= 200 && status < 400
        });

        const cookies = response.headers['set-cookie'];

        if (!cookies || cookies.length === 0) {
            // Se não houver cookies, verificamos se o erro está num redirecionamento sem cookies
            if (error.response && error.response.status >= 300) {
                 throw new Error('Redirecionamento da Alura não forneceu cookies de autenticação.');
            }
            throw new Error('Não foram recebidos cookies de autenticação da Alura na resposta inicial.');
        }
        
        const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
        
        res.status(200).json({ success: true, cookies: cookieString });

    } catch (error) {
        // Lida com o caso de o axios lançar um erro num redirecionamento 3xx
        if (error.response && error.response.status >= 300 && error.response.status < 400) {
            const cookies = error.response.headers['set-cookie'];
            if (!cookies || cookies.length === 0) {
                return res.status(500).json({ error: 'Redirecionamento sem cookies de autenticação.' });
            }
            const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
            return res.status(200).json({ success: true, cookies: cookieString });
        }
        
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na autenticação SSO da Alura. Detalhes: ${errorDetails}` });
    }
};
