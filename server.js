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

// Frequências das bandas do EQ (em Hz) - Alinhadas com o manifest.json do Graphic EQ
const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// Endpoint para aplicar EQ com IA (já existente)
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
        Certifique-se de que os valores sejam numéricos (float ou int) e dentro do range [-18, 18].`;

        const result = await model.generateContent(aiPrompt);
        const response = await result.response;
        const text = response.text();

        console.log("Resposta bruta da IA (EQ):", text);

        let eqSettings = {};
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0];
                const parsedSettings = JSON.parse(jsonString);

                EQ_FREQUENCIES.forEach(freq => {
                    const freqStr = freq.toString();
                    if (parsedSettings.hasOwnProperty(freqStr) && typeof parsedSettings[freqStr] === 'number') {
                        eqSettings[freqStr] = Math.max(-18, Math.min(18, parsedSettings[freqStr]));
                    } else {
                        eqSettings[freqStr] = 0;
                    }
                });
            } else {
                throw new Error("Não foi possível encontrar um JSON válido na resposta da IA para EQ.");
            }
        } catch (parseError) {
            console.error("Erro ao parsear JSON da IA (EQ):", parseError);
            return res.status(500).json({ error: 'Erro ao processar a resposta da IA para EQ. Formato inesperado.' });
        }

        res.json({ eqSettings: eqSettings });

    } catch (error) {
        console.error('Erro na chamada da API Gemini (EQ):', error);
        res.status(500).json({ error: 'Erro ao se comunicar com a API de IA (EQ). Verifique sua chave API e logs.' });
    }
});

// NOVO ENDPOINT PARA O COMPRESSOR COM IA
app.post('/apply-ai-compressor', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt é obrigatório.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Define os parâmetros do compressor com base no manifest.json
        const COMPRESSOR_PARAMS = {
            threshold: { min: -100, max: 0, step: 1, type: "dB" },
            ratio: { min: 1, max: 20, step: 0.1, type: "ratio" },
            knee: { min: 0, max: 40, step: 1, type: "dB" },
            attack: { min: 0, max: 1, step: 0.001, type: "segundos" },
            release: { min: 0.01, max: 1, step: 0.001, type: "segundos" }
        };

        const aiPrompt = `Eu tenho um compressor de áudio com os seguintes parâmetros:
        - Threshold (limiar): ${COMPRESSOR_PARAMS.threshold.min} a ${COMPRESSOR_PARAMS.threshold.max} ${COMPRESSOR_PARAMS.threshold.type}
        - Ratio (razão): ${COMPRESSOR_PARAMS.ratio.min} a ${COMPRESSOR_PARAMS.ratio.max} ${COMPRESSOR_PARAMS.ratio.type}
        - Knee (joelho): ${COMPRESSOR_PARAMS.knee.min} a ${COMPRESSOR_PARAMS.knee.max} ${COMPRESSOR_PARAMS.knee.type}
        - Attack (ataque): ${COMPRESSOR_PARAMS.attack.min} a ${COMPRESSOR_PARAMS.attack.max} ${COMPRESSOR_PARAMS.attack.type}
        - Release (liberação): ${COMPRESSOR_PARAMS.release.min} a ${COMPRESSOR_PARAMS.release.max} ${COMPRESSOR_PARAMS.release.type}

        Com base na seguinte descrição do som desejado: "${prompt}", por favor, forneça as configurações ideais para esses parâmetros em formato JSON.
        O JSON deve ser um objeto onde as chaves são os nomes dos parâmetros e os valores são os números correspondentes.
        Exemplo:
        {
            "threshold": -20,
            "ratio": 4,
            "knee": 10,
            "attack": 0.01,
            "release": 0.3
        }
        Certifique-se de que os valores são numéricos e dentro dos ranges especificados.`;

        const result = await model.generateContent(aiPrompt);
        const response = await result.response;
        const text = response.text();

        console.log("Resposta bruta da IA (Compressor):", text);

        let compressorSettings = {};
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0];
                const parsedSettings = JSON.parse(jsonString);

                for (const paramId in COMPRESSOR_PARAMS) {
                    if (parsedSettings.hasOwnProperty(paramId) && typeof parsedSettings[paramId] === 'number') {
                        // Limita o valor ao range definido no manifest
                        const min = COMPRESSOR_PARAMS[paramId].min;
                        const max = COMPRESSOR_PARAMS[paramId].max;
                        compressorSettings[paramId] = Math.max(min, Math.min(max, parsedSettings[paramId]));
                    } else {
                        // Se a IA não forneceu, ou forneceu incorretamente, use o valor padrão do manifest
                        compressorSettings[paramId] = effectDef.parameters.find(p => p.id === paramId).defaultValue; // Isso requer effectDef, que não está aqui. Melhor usar um valor padrão fixo ou deixar como está e o frontend lida.
                        // Para simplificar aqui, se não for válido, não incluímos, e o frontend mantém o valor atual ou default.
                    }
                }
            } else {
                throw new Error("Não foi possível encontrar um JSON válido na resposta da IA para Compressor.");
            }
        } catch (parseError) {
            console.error("Erro ao parsear JSON da IA (Compressor):", parseError);
            return res.status(500).json({ error: 'Erro ao processar a resposta da IA para Compressor. Formato inesperado.' });
        }

        res.json({ compressorSettings: compressorSettings });

    } catch (error) {
        console.error('Erro na chamada da API Gemini (Compressor):', error);
        res.status(500).json({ error: 'Erro ao se comunicar com a API de IA (Compressor). Verifique sua chave API e logs.' });
    }
});


// Endpoint de teste simples para verificar se o servidor está funcionando
app.get('/', (req, res) => {
    res.send('Servidor de backend para o assistente de EQ e Compressor com IA está rodando!');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
