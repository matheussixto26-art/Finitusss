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
        console.log(`[ALURA-AUTH DIAGNÓSTICO] A tentar fazer SSO para a Alura.`);
        
        // Fazemos o pedido e aceitamos QUALQUER status como sucesso para podermos inspecionar
        const response = await axios.get(aluraSsoUrl, {
            httpsAgent: agent,
            maxRedirects: 0,
            validateStatus: () => true // Aceita qualquer código de status
        });

        // Montamos um objeto de diagnóstico com toda a informação da resposta
        const diagnosticInfo = {
            message: "Esta é a resposta completa que o servidor da Alura nos deu.",
            status: response.status,
            headers: response.headers,
            data: response.data
        };
        
        // Devolvemos toda a informação de diagnóstico para o frontend
        return res.status(400).json({
            error: `DIAGNÓSTICO ALURA SSO: (${JSON.stringify(diagnosticInfo, null, 2)})`
        });

    } catch (error) {
        // Este bloco agora só deve apanhar erros de rede, não de status HTTP
        const errorDetails = error.response ? `Status ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
        console.error(`[ALURA-AUTH] Erro de rede inesperado:`, errorDetails);
        res.status(500).json({ error: `Falha na autenticação SSO da Alura. Detalhes: ${errorDetails}` });
    }
};
