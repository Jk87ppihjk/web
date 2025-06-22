// server.js (no seu repositório do GitHub/Render.com)

require('dotenv').config(); // Carrega variáveis de ambiente do .env localmente, se houver
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000; // Usa a porta definida pelo Render ou 3000

// Configurações CORS para permitir requisições do seu frontend na Hostinger
const corsOptions = {
  origin: '*', // Substitua '*' pelo domínio específico do seu frontend na Hostinger em produção para maior segurança (ex: 'https://seusite.com')
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use(express.json()); // Permite que o Express parseie JSON no corpo das requisições

// Inicializa a API Gemini
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("Erro: GEMINI_API_KEY não está definida nas variáveis de ambiente.");
    process.exit(1); // Encerra o processo se a chave não estiver configurada
}
const genAI = new GoogleGenerativeAI(API_KEY);

// Define as frequências que o EQ do frontend usa
const EQ_FREQUENCIES = [60, 170, 350, 600, 1000, 3500, 6000, 10000, 12000, 14000];

// Endpoint para aplicar EQ com IA
app.post('/apply-ai-eq', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt é obrigatório.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Aprimorando o prompt para guiar a IA a retornar o JSON esperado
        const aiPrompt = `Eu tenho um equalizador gráfico de 10 bandas com as seguintes frequências (em Hz): ${EQ_FREQUENCIES.join(', ')}.
        O ganho para cada banda deve estar entre -20 dB e +20 dB.
        Com base na seguinte descrição de áudio: "${prompt}", por favor, forneça as configurações de ganho para cada uma dessas frequências em formato JSON.
        O JSON deve ser um objeto onde as chaves são as frequências e os valores são os ganhos.
        Exemplo:
        {
            "60": 5.0,
            "170": -2.5,
            "350": 0.0,
            "600": 3.0,
            "1000": -1.0,
            "3500": 2.0,
            "6000": 0.0,
            "10000": -3.0,
            "12000": 1.5,
            "14000": 4.0
        }
        Certifique-se de que os valores sejam numéricos (float ou int) e dentro do range [-20, 20].`;

        const result = await model.generateContent(aiPrompt);
        const response = await result.response;
        const text = response.text();

        console.log("Resposta bruta da IA:", text);

        // Tentar extrair o JSON da resposta da IA
        let eqSettings = {};
        try {
            // A IA pode retornar texto antes ou depois do JSON. Tentar isolar o JSON.
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0];
                const parsedSettings = JSON.parse(jsonString);

                // Validar e filtrar as configurações de EQ para as frequências esperadas
                EQ_FREQUENCIES.forEach(freq => {
                    const freqStr = freq.toString();
                    if (parsedSettings.hasOwnProperty(freqStr) && typeof parsedSettings[freqStr] === 'number') {
                        // Limitar o ganho entre -20 e 20 dB
                        eqSettings[freqStr] = Math.max(-20, Math.min(20, parsedSettings[freqStr]));
                    } else {
                        // Se a IA não forneceu, ou forneceu incorretamente, mantenha 0
                        eqSettings[freqStr] = 0;
                    }
                });
            } else {
                throw new Error("Não foi possível encontrar um JSON válido na resposta da IA.");
            }
        } catch (parseError) {
            console.error("Erro ao parsear JSON da IA:", parseError);
            return res.status(500).json({ error: 'Erro ao processar a resposta da IA. Formato inesperado.' });
        }

        res.json({ eqSettings: eqSettings });

    } catch (error) {
        console.error('Erro na chamada da API Gemini:', error);
        res.status(500).json({ error: 'Erro ao se comunicar com a API de IA. Verifique sua chave API e logs.' });
    }
});

// Endpoint de teste simples para verificar se o servidor está funcionando
app.get('/', (req, res) => {
    res.send('Servidor de backend para o assistente de EQ com IA está rodando!');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
