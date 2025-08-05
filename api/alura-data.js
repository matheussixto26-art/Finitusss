const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { cookies } = req.body;
    if (!cookies) {
        return res.status(400).json({ error: 'Cookies são obrigatórios.' });
    }

    try {
        const response = await axios.post("https://api.moonscripts.cloud/alura-data", { cookies }, {
            httpsAgent: agent,
            timeout: 8000
        });
        res.status(200).json(response.data);
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ error: 'O serviço externo (Alura Data) demorou muito para responder.' });
        }
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha ao buscar dados da Alura. Detalhes: ${errorDetails}` });
    }
};
