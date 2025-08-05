const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    // Agora ele espera 'tokenB'
    const { tokenB } = req.body;
    if (!tokenB) {
        return res.status(400).json({ error: 'Token de acesso (tokenB) é obrigatório.' });
    }

    try {
        const response = await axios.post("https://api.moonscripts.cloud/alura-auth", 
            { token: tokenB }, // O moonscripts espera um campo chamado "token"
            {
                httpsAgent: agent,
                timeout: 8000 // Timeout de 8 segundos
            }
        );
        res.status(200).json(response.data);
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ error: 'O serviço externo (Alura Auth) demorou muito para responder.' });
        }
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na autenticação da Alura. Detalhes: ${errorDetails}` });
    }
};
