const axios = require('axios');

async function fetchApiData(requestConfig) {
    try {
        const response = await axios(requestConfig); 
        return response.data;
    } catch (error) {
        console.error(`Falha controlada em: ${requestConfig.url}. Status: ${error.response?.status}. Detalhes: ${error.message}`);
        return null;
    }
}

// ***** ADIÇÃO 1: A FUNÇÃO PARA "ETIQUETAR" AS TAREFAS *****
function classifyTask(task) {
    const title = (task.title || '').toLowerCase();
    const tags = task.tags || [];
    if (tags.some(tag => tag.toLowerCase().includes('redacaopaulista')) || title.includes('redação')) {
        return 'essay';
    }
    const isProvaByTag = tags.some(tag => tag.toLowerCase().includes('prova'));
    if (task.is_exam === true || title.includes('prova') || title.includes('avaliação') || isProvaByTag) {
        return 'exam';
    }
    return 'task';
}

module.exports = async (req, res) => {
    try {
        console.log("--- INICIANDO /api/login (VERSÃO ESTÁVEL) ---");

        if (req.method !== 'POST') { return res.status(405).json({ error: 'Método não permitido.' }); }
        const { user, senha } = req.body;
        if (!user || !senha) { return res.status(400).json({ error: 'RA e Senha são obrigatórios.' }); }
        
        let loginResponse;
        try {
            loginResponse = await axios.post("https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken", { user, senha }, { headers: { "Ocp-Apim-Subscription-Key": "2b03c1db3884488795f79c37c069381a" } });
        } catch (error) {
            if (error.response?.status === 401) {
                return res.status(401).json({ error: 'RA ou Senha inválidos.' });
            }
            throw error;
        }

        if (!loginResponse.data || !loginResponse.data.token) { return res.status(401).json({ error: 'Credenciais inválidas ou resposta inesperada da SED.' }); }
        const tokenA = loginResponse.data.token;
        const userInfo = loginResponse.data.DadosUsuario;
        
        const exchangeResponse = await axios.post("https://edusp-api.ip.tv/registration/edusp/token", { token: tokenA }, { headers: { "Content-Type": "application/json", "x-api-realm": "edusp", "x-api-platform": "webclient" } });
        if (!exchangeResponse.data || !exchangeResponse.data.auth_token) { return res.status(500).json({ error: 'Falha ao obter o token secundário (Token B).' }); }
        const tokenB = exchangeResponse.data.auth_token;
        
        const roomUserData = await fetchApiData({ method: 'get', url: 'https://edusp-api.ip.tv/room/user?list_all=true', headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } });

        let publicationTargetsQuery = '';
        if (roomUserData && roomUserData.rooms) {
            const targets = roomUserData.rooms.flatMap(room => [room.publication_target, room.name, ...(room.group_categories?.map(g => g.id) || [])]);
            const cleanedTargets = [...new Set(targets)].filter(Boolean);
            publicationTargetsQuery = cleanedTargets.map(target => `publication_target[]=${encodeURIComponent(target)}`).join('&');
        }
        
        const baseTaskUrl = `https://edusp-api.ip.tv/tms/task/todo?limit=100&with_answer=true&${publicationTargetsQuery}`;
        const pendingTasksUrl = `${baseTaskUrl}&expired_only=false&answer_statuses=pending&answer_statuses=draft`;
        const expiredTasksUrl = `${baseTaskUrl}&expired_only=true&answer_statuses=pending&answer_statuses=draft`;
        
        const [raNumber, raDigit, raUf] = user.match(/^(\d+)(\d)(\w+)$/).slice(1);
        const requests = [
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "a84380a41b144e0fa3d86cbc25027fe6" } }),
             fetchApiData({ method: 'get', url: pendingTasksUrl, headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } }),
             fetchApiData({ method: 'get', url: expiredTasksUrl, headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/apisalaconquistas/api/salaConquista/conquistaAluno?CodigoAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "008ada07395f4045bc6e795d63718090" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "1a758fd2f6be41448079c9616a861b91" } }),
             fetchApiData({ method: 'get', url: `https://sedintegracoes.educacao.sp.gov.br/alunoapi/api/Aluno/ExibirAluno?inNumRA=${raNumber}&inDigitoRA=${raDigit}&inSiglaUFRA=${raUf}`, headers: { "Authorization": `Bearer ${tokenA}`, "Ocp-Apim-Subscription-Key": "b141f65a88354e078a9d4fdb1df29867" } })
        ];

        const [faltasData, pendingTasks, expiredTasks, conquistas, notificacoes, dadosAluno] = await Promise.all(requests);
        
        const allTasksRaw = (Array.isArray(pendingTasks) ? pendingTasks : []).concat(Array.isArray(expiredTasks) ? expiredTasks : []);
        const allTasks = [...new Map(allTasksRaw.map(task => [task.id, task])).values()];
        
        // ***** ADIÇÃO 2: A LINHA QUE USA A FUNÇÃO PARA ETIQUETAR *****
        const classifiedTasks = allTasks.map(task => ({ ...task, type: classifyTask(task) }));
        
        userInfo.NAME = userInfo.NAME || dadosAluno?.aluno?.nome || 'Aluno';
        if(dadosAluno?.aluno) { userInfo.NOME_ESCOLA = dadosAluno.aluno.nmEscola; userInfo.SALA = `${dadosAluno.aluno.nrAnoSerie}º ${dadosAluno.aluno.nmTurma}`; }

        const dashboardData = { tokenA, tokenB, userInfo, faltas: faltasData?.data || [], tarefas: classifiedTasks, conquistas: conquistas?.data || [], notificacoes: Array.isArray(notificacoes) ? notificacoes : [], rooms: roomUserData ? roomUserData.rooms : [] };
        res.status(200).json(dashboardData);

    } catch (error) {
        console.error("--- ERRO FATAL NA FUNÇÃO /api/login ---", error);
        res.status(500).json({ error: 'Ocorreu um erro fatal no servidor ao processar o login.', details: error.message });
    }
};
                                                                                                                                   
