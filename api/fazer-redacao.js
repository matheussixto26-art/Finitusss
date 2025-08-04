// CÓDIGO DE DIAGNÓSTICO TEMPORÁRIO
module.exports = async (req, res) => {
    // Tentamos ler a chave da API a partir das variáveis de ambiente da Vercel.
    const apiKey = process.env.GEMINI_API_KEY;

    // Se a chave não for encontrada, retornamos uma mensagem de erro específica.
    if (!apiKey) {
        return res.status(500).json({ 
            error: "DIAGNÓSTICO: A variável de ambiente GEMINI_API_KEY não foi encontrada no servidor da Vercel. Verifique se o nome está escrito exatamente como GEMINI_API_KEY." 
        });
    }

    // Se a chave for encontrada, retornamos uma mensagem de sucesso para confirmar.
    // Mostramos apenas os primeiros e últimos caracteres por segurança.
    return res.status(200).json({ 
        success: true,
        message: "DIAGNÓSTICO: Chave API encontrada com sucesso!",
        key_start: apiKey.substring(0, 8) + "...",
        key_end: "..." + apiKey.slice(-4)
    });
};
