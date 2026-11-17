import { CONFIG } from "./config.js";

const FALLBACK = {
  familia: [
    { title: "Orientação para familiares", description: "Informações sobre conversa respeitosa, limites e apoio a quem cuida.", category: "Família" },
    { title: "Rede de apoio para familiares", description: "Conheça possibilidades de grupos e serviços de orientação.", category: "Rede de apoio" }
  ],
  servicos: [
    { title: "Como encontrar serviços de saúde", description: "Entenda como localizar UBS, CAPS e CAPS AD nos canais oficiais.", category: "Serviços" },
    { title: "Preparando-se para buscar atendimento", description: "Organize suas dúvidas e procure orientação profissional.", category: "Informação" }
  ],
  autocuidado: [
    { title: "Pequenos passos de autocuidado", description: "Ideias simples para incluir pausas, apoio e descanso na rotina.", category: "Bem-estar" },
    { title: "Fortalecendo sua rede de confiança", description: "Pense em pessoas e serviços com quem você pode contar.", category: "Acolhimento" }
  ]
};

function renderCards(items, container) {
  if (!container) return;
  container.replaceChildren();
  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "service-card";
    const category = document.createElement("small");
    category.textContent = item.category || "Conteúdo recomendado";
    const title = document.createElement("h3");
    title.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description || "Material educativo do Recomeço.";
    card.append(category, title, description);
    container.appendChild(card);
  });
}

export function initRecommender() {
  const buttons = document.querySelectorAll(".recommend-button");
  const text = document.getElementById("recommendationText");
  const panel = document.getElementById("recommendationPanel");
  const results = document.getElementById("recommendationResults");

  buttons.forEach(button => {
    button.addEventListener("click", async () => {
      const topic = button.dataset.topic || "autocuidado";
      const queryMap = {
        familia: "orientação e apoio para familiares",
        servicos: "como encontrar serviços públicos de saúde e CAPS AD",
        autocuidado: "autocuidado, bem-estar e rede de confiança"
      };
      if (text) text.textContent = "Buscando materiais relacionados...";
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "center" });
      let items = FALLBACK[topic] || FALLBACK.autocuidado;
      if (CONFIG.recommenderApiUrl) {
        try {
          const response = await fetch(`${CONFIG.recommenderApiUrl}/recommend`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: queryMap[topic] || topic, limit: 3 })
          });
          if (!response.ok) throw new Error("API de recomendação indisponível.");
          const data = await response.json();
          if (Array.isArray(data.recommendations) && data.recommendations.length) {
            items = data.recommendations.map(item => ({
              title: item.title,
              description: item.description,
              category: item.category || "Recomendado"
            }));
          }
        } catch (error) {
          console.warn("[Recomendador] Usando fallback:", error.message);
        }
      }
      if (text) text.textContent = "Sugestões relacionadas ao tema escolhido. As recomendações são educativas e não representam avaliação clínica.";
      if (results) renderCards(items, results);
      else {
        const grid = document.getElementById("contentCards");
        if (grid) {
          const old = document.getElementById("dynamicRecommendations");
          if (old) old.remove();
          const wrap = document.createElement("div");
          wrap.id = "dynamicRecommendations";
          wrap.className = "service-grid mt-4";
          grid.insertAdjacentElement("afterend", wrap);
          renderCards(items, wrap);
        }
      }
    });
  });
}
