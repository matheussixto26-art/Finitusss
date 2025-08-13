const axios = require('axios');

// ***** MUDANÇA PRINCIPAL AQUI: Reescrito com 'fetch' nativo *****
async function fetchApiData(requestConfig) {
    try {
        const response = await fetch(requestConfig.url, {
            method: requestConfig.method,
            headers: requestConfig.headers,
        });

        if (!response.ok) {
            // Lança um erro para ser apanhado pelo bloco catch
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;

    } catch (error) {
        console.error(`Falha controlada em: ${requestConfig.url}. Detalhes: ${error.message}`);
        return null;
    }
}

function classifyTask(task) {
    const title = (task.title || '').toLowerCase();
    const tags = task.tags || [];
    if (tags.some(tag => tag.toLowerCase().includes('redacaopaulista')) || title.includes('redação')) { return 'essay'; }
    const isProvaByTag = tags.some(tag => tag.toLowerCase().includes('prova'));
    if (task.is_exam === true || title.includes('prova') || title.includes('avaliação') || isProvaByTag) { return 'exam'; }
    return 'task';
}

module.exports = async (req, res) => {
    try {
        if (req.method !== 'POST') { return res.status(405).json({ error: 'Método não permitido.' }); }
        const { user, senha } = req.body;
        if (!user || !senha) { return res.status(400).json({ error: 'RA e Senha são obrigatórios.' }); }
        
        let loginResponse;
        try {
            loginResponse = await axios.post("https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken", { user, senha }, { headers: { "Ocp-Apim-Subscription-Key": "2b03c1db3884488795f79c37c069381a" } });
        } catch (error) {
            if (error.response?.status === 401) { return res.status(401).json({ error: 'RA ou Senha inválidos. Verifique os seus dados.' }); }
            throw error;
        }

        if (!loginResponse.data || !loginResponse.data.token) { return res.status(401).json({ error: 'Credenciais inválidas.' }); }
        const tokenA = loginResponse.data.token;
        const exchangeResponse = await axios.post("https://edusp-api.ip.tv/registration/edusp/token", { token: tokenA }, { headers: { "Content-Type": "application/json", "x-api-realm": "edusp", "x-api-platform": "webclient" } });
        if (!exchangeResponse.data || !exchangeResponse.data.auth_token) { return res.status(500).json({ error: 'Falha ao obter o token secundário.' }); }
        const tokenB = exchangeResponse.data.auth_token;
        
        const roomUserData = await fetchApiData({ method: 'get', url: 'https://edusp-api.ip.tv/room/user?list_all=true', headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } });
        
        let publicationTargetsQuery = '';
        if (roomUserData && roomUserData.rooms) {
            const targets = roomUserData.rooms.flatMap(room => [room.publication_target, room.name, ...(room.group_categories?.map(g => g.id) || [])]);
            const cleanedTargets = [...new Set(targets)].filter(Boolean);
            publicationTargetsQuery = cleanedTargets.map(target => `publication_target[]=${encodeURIComponent(target)}`).join('&');
        }
        
        const baseTaskUrl = `https://edusp-api.ip.tv/tms/task/todo?limit=150&with_answer=true&${publicationTargetsQuery}`;
        const pendingTasksUrl = `${baseTaskUrl}&expired_only=false&answer_statuses=pending&answer_statuses=draft`;
        const expiredTasksUrl = `${baseTaskUrl}&expired_only=true&answer_statuses=pending&answer_statuses=draft`;

        const requests = [
             fetchApiData({ method: 'get', url: pendingTasksUrl, headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } }),
             fetchApiData({ method: 'get', url: expiredTasksUrl, headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" } }),
        ];
        const [pendingTasks, expiredTasks] = await Promise.all(requests);

        const allTasksRaw = (Array.isArray(pendingTasks) ? pendingTasks : []).concat(Array.isArray(expiredTasks) ? expiredTasks : []);
        const allTasksUnique = [...new Map(allTasksRaw.map(task => [task.id, task])).values()];
        
        const classifiedTasks = allTasksUnique.map(task => ({ ...task, type: classifyTask(task) }));

        const dashboardData = { tokenB, tarefas: classifiedTasks, rooms: roomUserData ? roomUserData.rooms : [] };
        res.status(200).json(dashboardData);
    } catch (error) {
        console.error("--- ERRO FATAL NA FUNÇÃO /api/login ---", error);
        res.status(500).json({ error: 'Ocorreu um erro fatal no servidor ao processar o login.', details: error.message });
    }
};
                                                                
