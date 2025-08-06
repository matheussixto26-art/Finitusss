const axios = require('axios');

async function fetchApiData(requestConfig) {
    try {
        const response = await axios(requestConfig);
        return response.data;
    } catch (error) {
        console.error(`Falha controlada em: ${requestConfig.url}. Detalhes: ${error.message}`);
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
        const loginResponse = await axios.post("https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken", { user, senha }, { headers: { "Ocp-Apim-Subscription-Key": "2b03c1db3884488795f79c37c069381a" } });
        const tokenA = loginResponse.data.token;
        const userInfo = loginResponse.data.DadosUsuario;
        if (!tokenA || !userInfo) return res.status(401).json({ error: 'Credenciais inválidas.' });

        const exchangeResponse = await axios.post("https://edusp-api.ip.tv/registration/edusp/token", { token: tokenA }, { headers: { "Content-Type": "application/json", "x-api-realm": "edusp", "x-api-platform": "webclient" } });
        const tokenB = exchangeResponse.data.auth_token;
        if (!tokenB) return res.status(500).json({ error: 'Falha ao obter o token secundário.' });
        
        const roomUserData = await fetchApiData({
            method: 'get',
            url: 'https://edusp-api.ip.tv/room/user?list_all=true',
            headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" }
        });

        let publicationTargetsQuery = '';
        if (roomUserData && roomUserData.rooms) {
            const targets = roomUserData.rooms.flatMap(room => [room.publication_target, room.name, ...(room.group_categories?.map(g => g.id) || [])]);
            publicationTargetsQuery = [...new Set(targets)].map(target => `publication_target[]=${encodeURIComponent(target)}`).join('&');
        }
        
        const [raNumber, raDigit, raUf] = user.match(/^(\d+)(\d)(\w+)$/).slice(1);

        const requests = [
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "a84380a41b144e0fa3d86cbc25027fe6" } }),
             fetchApiData({ method: 'get', url: `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&limit=100&${publicationTargetsQuery}`, headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/apisalaconquistas/api/salaConquista/conquistaAluno?CodigoAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "008ada07395f4045bc6e795d63718090" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "1a758fd2f6be41448079c9616a861b91" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/alunoapi/api/Aluno/ExibirAluno?inNumRA=${raNumber}&inDigitoRA=${raDigit}&inSiglaUFRA=${raUf}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "b141f65a88354e078a9d4fdb1df29867" } })
        ];

        const [faltasData, tarefas, conquistas, notificacoes, dadosAluno] = await Promise.all(requests);
        
        // Garante que o nome do usuário exista, mesmo que a chamada extra falhe
        userInfo.NAME = userInfo.NAME || dadosAluno?.aluno?.nome || 'Aluno';

        if(dadosAluno?.aluno) {
            userInfo.NOME_ESCOLA = dadosAluno.aluno.nmEscola;
            userInfo.SALA = `${dadosAluno.aluno.nrAnoSerie}º ${dadosAluno.aluno.nmTurma}`;
        }

        const dashboardData = {
            tokenA: tokenA,
            tokenB: tokenB,
            userInfo: userInfo,
            faltas: faltasData?.data || [],
            tarefas: Array.isArray(tarefas) ? tarefas : [],
            conquistas: conquistas?.data || [],
            notificacoes: Array.isArray(notificacoes) ? notificacoes : []
        };
        res.status(200).json(dashboardData);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'RA ou Senha inválidos, ou falha na API.' });
    }
};
          
