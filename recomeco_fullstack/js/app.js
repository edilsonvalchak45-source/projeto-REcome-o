import { initChatbot } from "./chatbot.js";
import { initRecommender } from "./recomendador.js";
import { initAuth } from "./auth.js";
import { listPublicResources, saveJournalEntry, isSupabaseReady } from "./supabase-client.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function showFeedback(message) {
  const el = $("#globalFeedback");
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  window.setTimeout(() => el.classList.remove("visible"), 3500);
}

function initNavigation() {
  const toggle = $("#menuToggle");
  const nav = $("#mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const opened = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(opened));
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }));
  }
}

const demoServices = [
  { name: "CAPS AD — exemplo demonstrativo", category: "CAPS AD", city: "Consulte sua cidade", state: "PR", description: "Serviço público de atenção psicossocial. Confirme a unidade de referência nos canais oficiais do município." },
  { name: "Unidade de Saúde — exemplo", category: "Saúde pública", city: "Sua região", state: "", description: "Procure a Secretaria Municipal de Saúde para localizar a unidade e verificar o fluxo de atendimento." },
  { name: "Grupo de mútua ajuda — exemplo", category: "Mútua ajuda", city: "Consulte reuniões locais", state: "", description: "Confirme diretamente com a organização os horários, endereço e formato das reuniões." },
  { name: "Apoio a familiares — exemplo", category: "Familiares", city: "Atendimento a confirmar", state: "", description: "Busque grupos e serviços de orientação para familiares na rede local." }
];

function renderServices(items) {
  const target = $("#serviceResults");
  if (!target) return;
  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhum serviço encontrado. Tente outro termo ou consulte a rede pública local.";
    target.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "service-card";
    const category = document.createElement("small");
    category.textContent = item.category || "Serviço";
    const title = document.createElement("h3");
    title.textContent = item.name;
    const city = document.createElement("p");
    city.textContent = [item.city, item.state].filter(Boolean).join(" — ");
    const description = document.createElement("p");
    description.textContent = item.description || "Consulte os canais oficiais para confirmar informações.";
    card.append(category, title, city, description);
    if (item.website) {
      const link = document.createElement("a");
      link.href = item.website;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Site oficial ↗";
      link.className = "text-button";
      card.appendChild(link);
    }
    target.appendChild(card);
  });
}

async function loadServices() {
  const type = $("#serviceType")?.value || "todos";
  const search = $("#serviceSearch")?.value.trim() || "";
  if (isSupabaseReady()) {
    const result = await listPublicResources({ type: type === "todos" ? null : type, search });
    if (!result.error && Array.isArray(result.data)) {
      renderServices(result.data);
      return;
    }
    console.warn("[Diretório] Supabase indisponível; usando dados demonstrativos.", result.error?.message);
  }
  const normalized = search.toLocaleLowerCase("pt-BR");
  const filtered = demoServices.filter(item =>
    (type === "todos" || item.category === type) &&
    (!normalized || `${item.name} ${item.city} ${item.description}`.toLocaleLowerCase("pt-BR").includes(normalized))
  );
  renderServices(filtered);
}

function initDirectory() {
  const button = $("#searchServices");
  const input = $("#serviceSearch");
  const type = $("#serviceType");
  if (button) button.addEventListener("click", loadServices);
  if (input) input.addEventListener("keydown", event => { if (event.key === "Enter") loadServices(); });
  if (type) type.addEventListener("change", loadServices);
  loadServices();
}

function initJourney() {
  const checks = $$("#goalList input[type=checkbox]");
  const progressLabel = $("#progressLabel");
  const progressBar = $("#progressBar");
  const resetButton = $("#resetGoals");
  const saveButton = $("#saveJournal");
  const feedback = $("#journalFeedback");
  if (!checks.length) return;

  const storageKey = "recomeco-goals-v1";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { saved = {}; }
  checks.forEach(check => { check.checked = Boolean(saved[check.dataset.goal]); });

  const update = () => {
    const count = checks.filter(check => check.checked).length;
    if (progressLabel) progressLabel.textContent = `${count} de ${checks.length}`;
    if (progressBar) progressBar.style.width = `${count / checks.length * 100}%`;
    const state = {};
    checks.forEach(check => { state[check.dataset.goal] = check.checked; });
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (error) { console.warn("Não foi possível salvar localmente.", error); }
  };
  checks.forEach(check => check.addEventListener("change", update));
  if (resetButton) resetButton.addEventListener("click", () => {
    checks.forEach(check => { check.checked = false; });
    update();
    if (feedback) feedback.textContent = "Atividades reiniciadas.";
  });
  if (saveButton) saveButton.addEventListener("click", async () => {
    const completed = checks.filter(check => check.checked).length;
    if (!isSupabaseReady()) {
      if (feedback) feedback.textContent = "Marcações salvas somente neste navegador. Configure o Supabase para persistir na conta.";
      return;
    }
    const result = await saveJournalEntry({
      title: "Resumo de atividades",
      body: `Atividades concluídas: ${completed} de ${checks.length}. Este registro contém apenas a contagem, sem detalhes pessoais.`
    });
    if (feedback) feedback.textContent = result.error ? result.error.message : "Resumo salvo na sua conta.";
  });
  update();
}

function initFooterYear() {
  const year = $("#currentYear");
  if (year) year.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initDirectory();
  initJourney();
  initChatbot();
  initRecommender();
  initAuth();
  initFooterYear();
});
