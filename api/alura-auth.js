const axios = require('axios');
const https = require('https');

// Agente para ignorar erros de certificado
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
        
        // Fazemos o pedido GET para o URL de SSO da Alura
        // O Axios vai seguir os redirecionamentos automaticamente.
        const response = await axios.get(aluraSsoUrl, {
            httpsAgent: agent,
        });

        // Após os redirecionamentos, os cookies de sessão estarão no histórico do Axios.
        // O `axios` gere isto internamente com um "cookie jar" quando segue redirecionamentos.
        // O objeto `response.request` contém a informação final do pedido.
        // A forma mais fiável de obter os cookies é através do cabeçalho da resposta final ou do redirecionamento.
        // No entanto, a forma como o axios lida com isto pode ser complexa.
        // Vamos tentar uma abordagem diferente e mais explícita para capturar os cookies.
        
        let cookies;
        
        // O Axios lança um erro para respostas 3xx por defeito, então vamos apanhá-lo no catch.
        // Esta chamada vai falhar de propósito para podermos apanhar os cookies no redirecionamento.
        await axios.get(aluraSsoUrl, {
            httpsAgent: agent,
            maxRedirects: 0, // Não seguir redirecionamentos
            validateStatus: status => status < 400 // Não tratar 3xx como erro
        });
        
        // Este código nunca será alcançado, o fluxo é intencionalmente direcionado para o catch.
        throw new Error("Fluxo inesperado na autenticação Alura.");

    } catch (error) {
        // O comportamento esperado é que o pedido resulte num erro de redirecionamento (status 302)
        // e que possamos extrair os cookies do cabeçalho da resposta.
        if (error.response && error.response.status >= 300 && error.response.status < 400) {
            const receivedCookies = error.response.headers['set-cookie'];
            if (!receivedCookies || receivedCookies.length === 0) {
                return res.status(500).json({ error: 'Redirecionamento da Alura não forneceu os cookies de autenticação.' });
            }
            const cookieString = receivedCookies.map(c => c.split(';')[0]).join('; ');
            console.log("[ALURA-AUTH] Cookies de sessão obtidos com sucesso.");
            return res.status(200).json({ success: true, cookies: cookieString });
        }
        
        // Se o erro for outro, mostramos os detalhes.
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: `Falha na autenticação SSO da Alura. Detalhes: ${errorDetails}` });
    }
};
