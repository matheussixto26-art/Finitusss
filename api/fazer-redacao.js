const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

const proxyHeaders = {
    'Origin': 'https://crimsonstrauss.xyz',
    'Referer': 'https://crimsonstrauss.xyz/redacao'
};

function extractJSONObject(str) {
    try {
        if (typeof str !== 'string') return str;
        const startIndex = str.indexOf('(');
        const endIndex = str.lastIndexOf(')');
        if (startIndex !== -1 && endIndex !== -1) {
            return JSON.parse(str.substring(startIndex + 1, endIndex));
        }
        return JSON.parse(str);
    } catch {
        return { error: "Falha ao fazer o parse da string.", originalString: str };
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { token, ra, senha } = req.body;
    if (!token || !ra || !senha) {
        return res.status(400).json({ error: 'Parâmetros em falta.' });
    }
    
    const PROXY_URL = "https://crimsonstrauss.xyz/eclipseprocess.php";

    try {
        const authResponse = await axios.post(`${PROXY_URL}?action=login_external_api`, { ra, senha }, { httpsAgent: agent, headers: proxyHeaders });
        const nick = authResponse.data.nick;
        if (!nick) throw new Error("Falha ao obter o nick na autenticação do proxy.");

        // ETAPA DE DIAGNÓSTICO
        const fetchRedacoesResponse = await axios.post(`${PROXY_URL}?action=login_and_fetch_redacoes`, {
            ra: ra,
            authToken: token,
            nick: nick
        }, { httpsAgent: agent, headers: proxyHeaders });
        
        const rawResponseData = fetchRedacoesResponse.data;
        const parsedData = extractJSONObject(rawResponseData);

        // Devolve tudo para o frontend para análise
        return res.status(400).json({
            error: "DIAGNÓSTICO AVANÇADO",
            respostaBruta: rawResponseData,
            resultadoDoParse: parsedData
        });

    } catch (error) {
        console.error("Erro no diagnóstico de redação:", error.response ? JSON.stringify(error.response.data) : error.message);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ success: false, error: `Falha no processo de diagnóstico. Detalhes: ${errorDetails}` });
    }
};
