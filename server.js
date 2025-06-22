// server.js (no seu repositório do GitHub/Render.com)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: '*', // Mantenha como '*' para desenvolvimento, mas mude para seu domínio em produção
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("Erro: GEMINI_API_KEY não está definida nas variáveis de ambiente.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(API_KEY);

// CORRIGIDO: Frequências das bandas do EQ (em Hz) - Alinhadas com o manifest.json
const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]; // <--- MUDANÇA AQUI!

app.post('/apply-ai-eq', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt é obrigatório.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const aiPrompt = `Eu tenho um equalizador gráfico de 10 bandas com as seguintes frequências (em Hz): ${EQ_FREQUENCIES.join(', ')}.
        O ganho para cada banda deve estar entre -18 dB e +18 dB.
        Com base na seguinte descrição de áudio: "${prompt}", por favor, forneça as configurações de ganho para cada uma dessas frequências em formato JSON.
        O JSON deve ser um objeto onde as chaves são as frequências (em string) e os valores são os ganhos.
        Exemplo:
        {
            "32": 5.0,
            "64": -2.5,
            "125": 0.0,
            "250": 3.0,
            "500": -1.0,
            "1000": 2.0,
            "2000": 0.0,
            "4000": -3.0,
            "8000": 1.5,
            "16000": 4.0
        }
        Certifique-se de que os valores sejam numéricos (float ou int) e dentro do range [-18, 18].`; // <--- MUDANÇA AQUI (range de ganho)

        const result = await model.generateContent(aiPrompt);
        const response = await result.response;
        const text = response.text();

        console.log("Resposta bruta da IA:", text);

        let eqSettings = {};
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0];
                const parsedSettings = JSON.parse(jsonString);

                EQ_FREQUENCIES.forEach(freq => {
                    const freqStr = freq.toString();
                    if (parsedSettings.hasOwnProperty(freqStr) && typeof parsedSettings[freqStr] === 'number') {
                        eqSettings[freqStr] = Math.max(-18, Math.min(18, parsedSettings[freqStr])); // <--- MUDANÇA AQUI (range de ganho)
                    } else {
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

app.get('/', (req, res) => {
    res.send('Servidor de backend para o assistente de EQ com IA está rodando!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
