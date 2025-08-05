const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Token é obrigatório.' });
    }

    try {
        const response = await axios.post("https://api.moonscripts.cloud/alura-auth", { token });
        res.status(200).json(response.data);
    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na autenticação da Alura. Detalhes: ${errorDetails}` });
    }
};
