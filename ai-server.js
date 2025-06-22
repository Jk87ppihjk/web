// ai-server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('google-generative-ai'); // <--- NOVA BIBLIOTECA

const app = express();
const port = process.env.PORT || 4000;

// --- Configuração do CORS ---
// SUBSTITUA 'https://kocodillo.com' pelo URL REAL do seu frontend (se for diferente)
app.use(cors({
  origin: 'https://kocodillo.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// --- Inicialização do Cliente Google Gemini AI ---
let generativeModel;
try {
  if (!process.env.GEMINI_API_KEY) { // <--- AGORA PROCURAMOS POR GEMINI_API_KEY
    throw new Error('Variável de ambiente GEMINI_API_KEY não definida.');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Escolha o modelo que melhor se adapta à sua necessidade. 'gemini-pro' é um bom ponto de partida para texto.
  generativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });
  console.log('Cliente Google Gemini AI inicializado com sucesso.');
} catch (error) {
  console.error('Falha ao inicializar o Cliente Google Gemini AI:', error);
  console.error('Verifique se GEMINI_API_KEY está configurada corretamente no Render.');
  process.exit(1); // Mantenha esta linha para garantir que o servidor não suba com a IA desativada
}

// --- Endpoint de exemplo: Análise de Sentimento com Gemini ---
// O Gemini é um modelo generativo, então faremos a análise de sentimento através de um prompt.
app.post('/api/analyze-sentiment', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'O texto é obrigatório para análise de sentimento.' });
  }

  if (!generativeModel) {
    return res.status(500).json({ error: 'Serviço Gemini AI não inicializado.' });
  }

  try {
    const prompt = `Analise o sentimento do seguinte texto e me dê uma pontuação de -1.0 (negativo) a 1.0 (positivo), e uma breve descrição do sentimento. Responda apenas com um JSON no formato: {"score": <valor_numerico>, "description": "<texto_descritivo>"}.\n\nTexto: "${text}"`;

    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().trim(); // Pega apenas o texto da resposta e remove espaços

    console.log("Resposta bruta do Gemini:", jsonText); // Para depuração

    let sentimentAnalysis;
    try {
        sentimentAnalysis = JSON.parse(jsonText);
        // Validação básica para garantir que o Gemini retornou o formato esperado
        if (typeof sentimentAnalysis.score !== 'number' || typeof sentimentAnalysis.description !== 'string') {
            throw new Error('Formato JSON inesperado do Gemini.');
        }
    } catch (parseError) {
        console.error('Erro ao fazer parse da resposta do Gemini como JSON:', parseError);
        console.error('Resposta do Gemini que causou o erro:', jsonText);
        return res.status(500).json({ error: 'Falha ao processar a resposta da IA. Formato inesperado.' });
    }

    res.json({
      score: sentimentAnalysis.score,
      magnitude: Math.abs(sentimentAnalysis.score), // Magnitude é o valor absoluto do score para Gemini
      message: `Sentimento: ${sentimentAnalysis.description}, Pontuação: ${sentimentAnalysis.score}`
    });

  } catch (error) {
    console.error('Erro ao analisar sentimento com Gemini:', error);
    res.status(500).json({ error: 'Falha ao analisar sentimento com IA. Por favor, tente novamente.' });
  }
});

// --- Endpoint de "saúde" (Health Check) ---
app.get('/', (req, res) => {
  res.send('Infinit DAW AI Backend is running with Gemini!');
});

// --- Iniciar o Servidor ---
app.listen(port, () => {
  console.log(`AI Backend listening on port ${port}`);
});
