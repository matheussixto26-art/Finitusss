const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { cookies } = req.body;
    if (!cookies) {
        return res.status(400).json({ error: 'Cookies são obrigatórios.' });
    }

    try {
        const response = await axios.post("https://api.moonscripts.cloud/alura-data", { cookies });
        res.status(200).json(response.data);
    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha ao buscar dados da Alura. Detalhes: ${errorDetails}` });
    }
};
