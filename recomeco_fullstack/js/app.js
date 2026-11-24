import { initChatbot } from "./chatbot.js";
import { initRecommender } from "./recomendador.js";
import { listPublicResources, isSupabaseReady } from "./supabase-client.js";

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

function renderServices(items, targetId = "serviceResults", emptyMessage = "Nenhum serviço encontrado. Tente outro termo ou consulte a rede pública local.") {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyMessage;
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
    const description = document.createElement("p");
    description.textContent = item.description || "Consulte os canais oficiais para confirmar informações.";
    card.append(category, title);
    const location = [item.address, [item.city, item.state].filter(Boolean).join(" — ")].filter(Boolean).join(" · ");
    if (location) {
      const locationText = document.createElement("p");
      locationText.textContent = location;
      card.appendChild(locationText);
    }
    card.appendChild(description);
    if (item.phone) {
      const phone = document.createElement("a");
      const telephone = item.phone.replace(/[^\d+]/g, "");
      phone.href = `tel:${telephone}`;
      phone.textContent = `Telefone: ${item.phone}`;
      phone.className = "text-button";
      card.appendChild(phone);
    }
    if (item.website) {
      try {
        const website = new URL(item.website);
        if (website.protocol === "https:" || website.protocol === "http:") {
          const link = document.createElement("a");
          link.href = website.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Site oficial ↗";
          link.className = "text-button";
          card.appendChild(link);
        }
      } catch {
        console.warn("[Diretório] Endereço de site inválido para o registro:", item.name);
      }
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

async function loadClinics() {
  const search = $("#clinicSearch")?.value.trim() || "";
  if (!isSupabaseReady()) {
    renderServices([], "clinicResults", "O diretório de clínicas ainda não está conectado ao Supabase.");
    return;
  }

  const result = await listPublicResources({ type: "Clínicas", search });
  if (result.error || !Array.isArray(result.data)) {
    console.error("[Diretório] Não foi possível carregar as clínicas.", result.error);
    renderServices([], "clinicResults", "Não foi possível carregar as clínicas agora. Tente novamente mais tarde.");
    return;
  }
  renderServices(result.data, "clinicResults", "Nenhuma clínica publicada foi encontrada. Tente outro nome ou cidade.");
}

function initDirectory() {
  const button = $("#searchServices");
  const input = $("#serviceSearch");
  const type = $("#serviceType");
  if (button) button.addEventListener("click", loadServices);
  if (input) input.addEventListener("keydown", event => { if (event.key === "Enter") loadServices(); });
  if (type) type.addEventListener("change", loadServices);
  loadServices();

  const clinicButton = $("#searchClinics");
  const clinicInput = $("#clinicSearch");
  if (clinicButton) clinicButton.addEventListener("click", loadClinics);
  if (clinicInput) clinicInput.addEventListener("keydown", event => { if (event.key === "Enter") loadClinics(); });
  loadClinics();
}

function initJourney() {
  const checks = $$("#goalList input[type=checkbox]");
  const progressLabel = $("#progressLabel");
  const progressBar = $("#progressBar");
  const resetButton = $("#resetGoals");
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
  initFooterYear();
});

/**
 * Módulo de Acessibilidade e Emergência 24h — Projeto Recomeço
 */
document.addEventListener("DOMContentLoaded", () => {
  initModalEmergencia();
  initAcessibilidade();
});

/* 
   1. MODAL DE AJUDA URGENTE 24H
 */
function initModalEmergencia() {
  const modal = document.getElementById("modal-emergencia");
  const btnAbrir = document.getElementById("btn-emergencia");
  const btnFechar = document.getElementById("btn-fechar-modal");

  if (!modal || !btnAbrir || !btnFechar) return;

  const abrirModal = () => {
    if (!modal.open) {
      modal.showModal();
    }
  };

  const fecharModal = () => {
    if (modal.open) {
      modal.close();
      btnAbrir.focus(); // Devolve o foco ao botão de origem (boa prática WCAG)
    }
  };

  btnAbrir.addEventListener("click", abrirModal);
  btnFechar.addEventListener("click", fecharModal);

  // Fecha o modal ao clicar fora da caixa (no fundo escuro)
  modal.addEventListener("click", (event) => {
    const limite = modal.getBoundingClientRect();
    const clicouFora =
      event.clientX < limite.left ||
      event.clientX > limite.right ||
      event.clientY < limite.top ||
      event.clientY > limite.bottom;

    if (clicouFora) {
      fecharModal();
    }
  });
}

/* 
   2. CONTROLES DE ACESSIBILIDADE (FONTE + ZOOM + CONTRASTE)
 */
function initAcessibilidade() {
  const CONFIG = {
    escalaMinima: 85,
    escalaMaxima: 130,
    escalaPadrao: 100,
    passo: 10,
    chaveEscala: "recomeco_escala_tela",
    chaveContraste: "recomeco_alto_contraste",
  };

  const elementos = {
    btnDiminuir: document.getElementById("btn-diminuir"),
    btnNormal: document.getElementById("btn-normal"),
    btnAumentar: document.getElementById("btn-aumentar"),
    btnContraste: document.getElementById("btn-contraste"),
  };

  // Recupera preferências salvas anteriormente ou usa o padrão
  let escalaAtual = Number(localStorage.getItem(CONFIG.chaveEscala)) || CONFIG.escalaPadrao;
  let contrasteAtivo = localStorage.getItem(CONFIG.chaveContraste) === "true";

  /**
   * Aplica simultaneamente a escala de fonte e o zoom visual da página
   */
  const aplicarEscala = (novaEscala) => {
    // Garante que o valor nunca ultrapasse os limites mínimo e máximo
    escalaAtual = Math.min(CONFIG.escalaMaxima, Math.max(CONFIG.escalaMinima, novaEscala));

    // Calcula um zoom suave em sincronia com a fonte para não quebrar o layout
    const fatorZoom = 1 + (escalaAtual - 100) / 200; // Ex.: 120% fonte = 1.10 (110%) de zoom

    document.documentElement.style.fontSize = `${escalaAtual}%`;
    document.body.style.zoom = fatorZoom.toFixed(2);

    // Desabilita visualmente os botões quando atingem o limite
    if (elementos.btnDiminuir) {
      elementos.btnDiminuir.disabled = escalaAtual <= CONFIG.escalaMinima;
    }
    if (elementos.btnAumentar) {
      elementos.btnAumentar.disabled = escalaAtual >= CONFIG.escalaMaxima;
    }

    localStorage.setItem(CONFIG.chaveEscala, String(escalaAtual));
  };

  /**
   * Ativa ou desativa o tema de alto contraste e atualiza atributos ARIA
   */
  const aplicarContraste = (ativar) => {
    contrasteAtivo = Boolean(ativar);
    document.body.classList.toggle("alto-contraste", contrasteAtivo);

    if (elementos.btnContraste) {
      elementos.btnContraste.setAttribute("aria-pressed", String(contrasteAtivo));
    }

    localStorage.setItem(CONFIG.chaveContraste, String(contrasteAtivo));
  };

  // Eventos dos botões
  elementos.btnAumentar?.addEventListener("click", () => {
    aplicarEscala(escalaAtual + CONFIG.passo);
  });

  elementos.btnDiminuir?.addEventListener("click", () => {
    aplicarEscala(escalaAtual - CONFIG.passo);
  });

  elementos.btnNormal?.addEventListener("click", () => {
    aplicarEscala(CONFIG.escalaPadrao);
  });

  elementos.btnContraste?.addEventListener("click", () => {
    aplicarContraste(!contrasteAtivo);
  });

  // Inicializa a página aplicando o estado salvo
  aplicarEscala(escalaAtual);
  aplicarContraste(contrasteAtivo);
}

