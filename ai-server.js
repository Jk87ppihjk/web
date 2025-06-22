// ai-server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('google-generative-ai'); // Biblioteca para o Gemini API

const app = express();
const port = process.env.PORT || 4000;

// --- Configuração do CORS ---
// É crucial para o seu frontend na Hostinger se comunicar com este backend.
// SUBSTITUA 'https://kocodillo.com' pelo URL REAL do seu frontend da DAW se for diferente!
app.use(cors({
  origin: 'https://kocodillo.com', // Certifique-se de que este é o domínio exato do seu frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// --- Inicialização do Cliente Google Gemini AI ---
let generativeModel;
try {
  // Verifica se a variável de ambiente GEMINI_API_KEY está definida
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Variável de ambiente GEMINI_API_KEY não definida. Certifique-se de configurá-la no Render.');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Escolha o modelo que melhor se adapta à sua necessidade. 'gemini-pro' é bom para texto.
  generativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });
  console.log('Cliente Google Gemini AI inicializado com sucesso.');
} catch (error) {
  // Se a inicialização do Gemini falhar (provavelmente por causa da chave de API), o servidor irá parar.
  console.error('Falha ao inicializar o Cliente Google Gemini AI:', error.message);
  console.error('Por favor, verifique se sua GEMINI_API_KEY está correta e completa no Render.com.');
  process.exit(1); // Mantenha esta linha para garantir que o servidor não suba com a IA desativada
}

// --- Endpoint de exemplo: Análise de Sentimento com Gemini ---
// Este endpoint usa o Gemini para analisar o sentimento de um texto.
// Ele envia um prompt para o modelo e espera um JSON como resposta.
app.post('/api/analyze-sentiment', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'O texto é obrigatório para análise de sentimento.' });
  }

  // Verifica se o modelo Gemini foi inicializado com sucesso
  if (!generativeModel) {
    return res.status(500).json({ error: 'Serviço Gemini AI não inicializado. Verifique os logs do servidor para mais detalhes.' });
  }

  try {
    // Prompt para instruir o Gemini a analisar o sentimento e retornar um JSON
    const prompt = `Analise o sentimento do seguinte texto e me dê uma pontuação de -1.0 (negativo) a 1.0 (positivo), e uma breve descrição do sentimento. Responda apenas com um JSON no formato: {"score": <valor_numerico>, "description": "<texto_descritivo>"}.\n\nTexto: "${text}"`;

    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().trim(); // Pega apenas o texto da resposta do Gemini e remove espaços em branco

    console.log("Resposta bruta do Gemini:", jsonText); // Útil para depuração

    let sentimentAnalysis;
    try {
        // Tenta fazer o parse da resposta do Gemini como JSON
        sentimentAnalysis = JSON.parse(jsonText);
        // Validação básica para garantir que o Gemini retornou o formato JSON esperado
        if (typeof sentimentAnalysis.score !== 'number' || typeof sentimentAnalysis.description !== 'string') {
            throw new Error('Formato JSON inesperado da resposta do Gemini.');
        }
    } catch (parseError) {
        console.error('Erro ao fazer parse da resposta do Gemini como JSON:', parseError);
        console.error('Resposta do Gemini que causou o erro de parse:', jsonText);
        return res.status(500).json({ error: 'Falha ao processar a resposta da IA. Formato inesperado.' });
    }

    res.json({
      score: sentimentAnalysis.score,
      magnitude: Math.abs(sentimentAnalysis.score), // Magnitude é o valor absoluto do score para o Gemini neste contexto
      message: `Sentimento: ${sentimentAnalysis.description}, Pontuação: ${sentimentAnalysis.score}`
    });

  } catch (error) {
    console.error('Erro na chamada da API Gemini para análise de sentimento:', error);
    // Verifique se o erro é devido a uma chave de API inválida (400 Invalid json_payload, 403 API key not valid)
    if (error.response && error.response.status === 400 && error.response.error.message.includes('API key not valid')) {
        return res.status(401).json({ error: 'Chave de API Gemini inválida. Verifique sua configuração no Render.' });
    }
    res.status(500).json({ error: 'Falha ao analisar sentimento com IA. Por favor, tente novamente.' });
  }
});

// --- Endpoint de "saúde" (Health Check) ---
// Útil para verificar se o servidor está online e respondendo.
app.get('/', (req, res) => {
  res.send('Infinit DAW AI Backend is running with Gemini!');
});

// --- Iniciar o Servidor ---
// O servidor escutará na porta fornecida pelo Render (process.env.PORT) ou na 4000 localmente.
app.listen(port, () => {
  console.log(`AI Backend listening on port ${port}`);
});
