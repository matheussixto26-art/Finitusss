const axios = require('axios');

async function fetchApiData(requestConfig) {
    try {
        const response = await axios(requestConfig);
        return response.data;
    } catch (error) {
        console.error(`Falha controlada em: ${requestConfig.url}. O processo continuará.`);
        return null;
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { user, senha } = req.body;
    if (!user || !senha) {
        return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });
    }
    try {
        // Passo 1: Login principal para obter tokenA e userInfo básico
        const loginResponse = await axios.post("https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken", { user, senha }, { headers: { "Ocp-Apim-Subscription-Key": "2b03c1db3884488795f79c37c069381a" } });
        const tokenA = loginResponse.data.token;
        const userInfo = loginResponse.data.DadosUsuario;
        if (!tokenA || !userInfo) return res.status(401).json({ error: 'Credenciais inválidas.' });

        // Passo 2: Trocar tokenA por tokenB para acesso à Sala do Futuro
        const exchangeResponse = await axios.post("https://edusp-api.ip.tv/registration/edusp/token", { token: tokenA }, { headers: { "Content-Type": "application/json", "x-api-realm": "edusp", "x-api-platform": "webclient" } });
        const tokenB = exchangeResponse.data.auth_token;
        if (!tokenB) return res.status(500).json({ error: 'Falha ao obter o token secundário.' });
        
        // Passo 3: Obter "publication targets" para filtrar as tarefas corretamente
        const roomUserData = await fetchApiData({
            method: 'get',
            url: 'https://edusp-api.ip.tv/room/user?list_all=true',
            headers: { "x-api-key": tokenB }
        });
        let publicationTargetsQuery = '';
        if (roomUserData?.rooms) {
            const targets = roomUserData.rooms.flatMap(room => room.publication_target);
            publicationTargetsQuery = [...new Set(targets)].map(target => `publication_target[]=${encodeURIComponent(target)}`).join('&');
        }
        
        const [raNumber, raDigit, raUf] = user.match(/^(\d+)(\d)(\w+)$/).slice(1);

        // Passo 4: Fazer todos os pedidos de dados em paralelo
        const requests = [
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "a84380a41b144e0fa3d86cbc25027fe6" } }),
             fetchApiData({ method: 'get', url: `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&limit=100&${publicationTargetsQuery}`, headers: { "x-api-key": tokenB } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/apisalaconquistas/api/salaConquista/conquistaAluno?CodigoAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "008ada07395f4045bc6e795d63718090" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "1a758fd2f6be41448079c9616a861b91" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/alunoapi/api/Aluno/ExibirAluno?inNumRA=${raNumber}&inDigitoRA=${raDigit}&inSiglaUFRA=${raUf}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "b141f65a88354e078a9d4fdb1df29867" } })
        ];

        const [faltasData, tarefas, conquistasData, notificacoes, dadosAluno] = await Promise.all(requests);
        
        // Passo 5: Montar o objeto final de forma segura
        // Garante que o nome do usuário sempre existe
        userInfo.NAME = userInfo.NAME || dadosAluno?.aluno?.nome || 'Aluno';
        if(dadosAluno?.aluno) {
            userInfo.NOME_ESCOLA = dadosAluno.aluno.nmEscola;
            userInfo.SALA = `${dadosAluno.aluno.nrAnoSerie}º ${dadosAluno.aluno.nmTurma}`;
        }

        res.status(200).json({
            tokenB,
            userInfo,
            faltas: faltasData?.data || [],
            tarefas: Array.isArray(tarefas) ? tarefas : [],
            conquistas: conquistasData?.data?.listaDeConquistas || [],
            notificacoes: Array.isArray(notificacoes) ? notificacoes : []
        });
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'RA ou Senha inválidos, ou falha na API.' });
    }
};
            
