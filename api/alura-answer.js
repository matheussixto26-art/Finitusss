const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { cookies, url } = req.body;
    if (!cookies || !url) {
        return res.status(400).json({ error: 'Cookies e URL do curso são obrigatórios.' });
    }

    try {
        const response = await axios.post("https://api.moonscripts.cloud/alura-answer", { cookies, url }, {
            httpsAgent: agent,
            timeout: 7000 // Timeout de 7 segundos
        });
        res.status(200).json(response.data);
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ error: 'O serviço externo (Alura Answer) demorou muito para responder. Tente novamente mais tarde.' });
        }
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha ao finalizar curso da Alura. Detalhes: ${errorDetails}` });
    }
};
