const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { cookies, url } = req.body;
    if (!cookies || !url) {
        return res.status(400).json({ error: 'Cookies e URL do curso são obrigatórios.' });
    }

    try {
        const response = await axios.post("https://api.moonscripts.cloud/alura-answer", { cookies, url });
        res.status(200).json(response.data);
    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha ao finalizar curso da Alura. Detalhes: ${errorDetails}` });
    }
};
