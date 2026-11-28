const SAFETY_TERMS = /(overdose|intoxica|desmai|não respira|convuls|suic|me matar|tirar minha vida|me machucar)/i;
const EMERGENCY_REPLY = "Isso pode exigir ajuda imediata. Se houver risco médico ou perigo imediato, ligue 192 (SAMU) ou procure um pronto atendimento agora. Para apoio emocional, o CVV atende pelo 188. Este chat não é monitorado por uma equipe de emergência.";

export function initChatbot() {
  const dialog = document.getElementById("chatDialog");
  const openButtons = ["openChat", "openChatPreview", "floatingChat"].map(id => document.getElementById(id)).filter(Boolean);
  const closeButton = document.getElementById("closeChat");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const messages = document.getElementById("chatMessages");
  const typing = document.getElementById("chatTyping");
  if (!dialog || !form || !input || !messages) return;

  const history = [];
  const addMessage = (text, role) => {
    const item = document.createElement("div");
    item.className = `message ${role === "user" ? "user-message" : "bot-message"}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  };
  const open = () => {
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    input.focus();
  };
  openButtons.forEach(button => button.addEventListener("click", open));
  if (closeButton) closeButton.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    if (message.length > 2000) {
      addMessage("Sua mensagem está muito longa. Tente resumir sua dúvida.", "bot");
      return;
    }
    addMessage(message, "user");
    history.push({ role: "user", content: message });
    input.value = "";
    if (SAFETY_TERMS.test(message)) {
      addMessage(EMERGENCY_REPLY, "assistant");
      history.push({ role: "assistant", content: EMERGENCY_REPLY });
      return;
    }
    if (typing) typing.hidden = false;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          history: history.slice(0, -1)
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Falha ao comunicar com o assistente (${response.status}).`);
      }

      const reply = (data.reply || data.response || data.message || "").trim() || "Não consegui formular uma resposta agora. Tente novamente em instantes.";

      addMessage(reply, "assistant");
      history.push({ role: "assistant", content: reply });
    } catch (error) {
      console.error(error);
      const reply = `${error.message} Em uma emergência, ligue 192.`;
      addMessage(reply, "assistant");
      history.push({ role: "assistant", content: reply });
    } finally {
      if (typing) typing.hidden = true;
      if (submitButton) submitButton.disabled = false;
      input.focus();
    }
  });
}