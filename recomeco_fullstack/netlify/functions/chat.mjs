const SYSTEM_INSTRUCTIONS = `Você é o Assistente Recomeço, um assistente informativo, acolhedor e não julgador.
Responda em português brasileiro, com linguagem simples, breve e respeitosa.
O projeto oferece informação educativa e orientação geral. Não faça diagnósticos, não prescreva medicamentos, não avalie risco clínico e não prometa sigilo absoluto.
Não invente endereços, horários, instituições, vagas ou disponibilidade. Recomende confirmar serviços nos canais oficiais.
Não substitua profissionais, terapia, atendimento médico ou serviços de emergência.
Se a pessoa relatar risco imediato, intoxicação, overdose, dificuldade respiratória, convulsão ou perigo físico, recomende ligar 192 (SAMU) e procurar emergência imediatamente. Para apoio emocional, informe CVV 188.
Não solicite nome completo, endereço, documentos ou detalhes íntimos. Não peça dados sensíveis.
Se não souber responder, diga claramente e oriente a procurar um profissional ou fonte oficial.`;

const emergencyPattern = /(overdose|intoxica|desmai|não respira|nao respira|convuls|suic|me matar|tirar minha vida|me machucar|risco imediato)/i;
const emergencyText = "Isso pode exigir ajuda imediata. Se houver risco médico ou perigo imediato, ligue 192 (SAMU) ou procure um pronto atendimento agora. Para apoio emocional, o CVV atende pelo 188. Este assistente não é monitorado por uma equipe de emergência.";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    },
    body: JSON.stringify(body)
  };
}

function getFallbackReply(message) {
  const text = message.toLowerCase();

  if (/(caps|sus|unidade|cl[ií]nica|atendimento|m[eé]dico|posto|upa|hospital|gratuito)/.test(text)) {
    return "Pelo SUS, o atendimento gratuito em saúde mental e apoio relacionado ao uso de álcool e outras drogas é feito nos CAPS (Centros de Atenção Psicossocial) e nas Unidades Básicas de Saúde (UBS) da sua cidade. Você também pode consultar os serviços listados aqui no diretório do Recomeço e confirmar horários diretamente nos canais oficiais de cada instituição.";
  }

  if (/(fam[ií]lia|filho|filha|m[ãa]e|pai|irm[ãa]o|amigo|ajudar algu[eé]m|familiar)/.test(text)) {
    return "Apoiar alguém próximo exige acolhimento, escuta sem julgamento e também cuidado com você mesmo. Você pode buscar orientação gratuita em grupos de apoio a familiares (como Amor-Exigente ou Al-Anon/Nar-Anon) e conversar com a equipe de um CAPS ou UBS da sua região para receber acompanhamento adequado.";
  }

  if (/(triste|ansied|ang[úu]stia|conversar|desabafar|sozinho|sozinha|depress|emocional)/.test(text)) {
    return "Você não precisa passar por isso sozinho. Se quiser conversar agora com alguém de forma gratuita e sigilosa, o CVV (Centro de Valorização da Vida) atende 24 horas pelo telefone 188 ou pelo site cvv.org.br. Para acompanhamento contínuo, procure uma Unidade Básica de Saúde ou o CAPS mais próximo.";
  }

  return "No momento estou com instabilidade para gerar uma resposta personalizada, mas você pode explorar o diretório de apoio aqui na plataforma Recomeço para encontrar serviços públicos e comunitários. Se precisar de apoio emocional imediato, ligue 188 (CVV), ou 192 (SAMU) em caso de emergência médica.";
}

async function callGemini(model, apiKey, contents, timeoutMs = 8000) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
      contents,
      generationConfig: {
        maxOutputTokens: 350,
        temperature: 0.7,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    })
  });
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Método não permitido." });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido." });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return json(400, { error: "Envie uma mensagem válida com até 2.000 caracteres." });
  }
  if (emergencyPattern.test(message)) {
    return json(200, { reply: emergencyText, mode: "safety" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(200, { reply: getFallbackReply(message), mode: "fallback" });
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-6).filter(item =>
        item && ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string" && item.content.length <= 2000
      )
    : [];

  const contents = [
    ...history.map(item => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    })),
    {
      role: "user",
      parts: [{ text: message }]
    }
  ];

  const primaryModel = "gemini-3.8-flash-lite";
  const fallbackModel = "gemini-3.8-flash";

  try {
    let response;
    try {
      response = await callGemini(primaryModel, apiKey, contents, 7500);
    } catch {
      response = await callGemini(fallbackModel, apiKey, contents, 7500);
    }

    if (response && !response.ok) {
      response = await callGemini(fallbackModel, apiKey, contents, 7500);
    }

    if (!response || !response.ok) {
      console.warn("Gemini indisponível, acionando resposta local de contingência.");
      return json(200, { reply: getFallbackReply(message), mode: "fallback" });
    }

    const data = await response.json().catch(() => ({}));
    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("\n")
      .trim();

    if (!reply) {
      return json(200, { reply: getFallbackReply(message), mode: "fallback" });
    }

    return json(200, { reply, mode: "ai" });
  } catch (error) {
    console.warn("Acionando fallback após falha/timeout:", error.message);
    return json(200, { reply: getFallbackReply(message), mode: "fallback" });
  }
}