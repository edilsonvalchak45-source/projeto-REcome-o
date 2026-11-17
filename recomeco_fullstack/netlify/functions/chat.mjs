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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Método não permitido." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "JSON inválido." }); }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) return json(400, { error: "Envie uma mensagem válida com até 2.000 caracteres." });
  if (emergencyPattern.test(message)) return json(200, { reply: emergencyText, mode: "safety" });

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return json(503, { error: "O assistente de IA ainda não foi configurado no servidor." });

  const history = Array.isArray(body.history)
    ? body.history.slice(-6).filter(item =>
        item && ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string" && item.content.length <= 2000
      )
    : [];

  const input = [
    ...history.map(item => ({ role: item.role, content: [{ type: "input_text", text: item.content }] })),
    { role: "user", content: [{ type: "input_text", text: message }] }
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4.1-mini",
        instructions: SYSTEM_INSTRUCTIONS,
        input,
        max_output_tokens: 350,
        store: false
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("AI provider error:", response.status, data?.error?.type || "unknown");
      return json(502, { error: "O assistente não conseguiu responder agora. Tente novamente em instantes." });
    }

    const reply = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n")
      .trim();

    if (!reply) return json(502, { error: "A resposta do assistente veio vazia. Tente novamente." });
    return json(200, { reply, mode: "ai" });
  } catch (error) {
    console.error("Chat function failed:", error.message);
    return json(500, { error: "Falha interna ao processar a conversa." });
  }
}
