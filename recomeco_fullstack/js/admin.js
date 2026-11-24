import {
  createClinic,
  getSession,
  isCurrentUserAdmin,
  isSupabaseReady,
  listAdminClinics,
  onAuthStateChange,
  signIn,
  signOut,
  signUp
} from "./supabase-client.js";

const $ = selector => document.querySelector(selector);
const authPanel = $("#authPanel");
const accessPanel = $("#accessPanel");
const clinicPanel = $("#clinicPanel");
const clinicListPanel = $("#clinicListPanel");
const promotionInstructions = $("#promotionInstructions");
let refreshId = 0;

function setFeedback(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function showClinicList(items) {
  const target = $("#adminClinicList");
  if (!target) return;
  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "Ainda não há clínicas cadastradas.";
    target.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "admin-clinic-card";
    const status = document.createElement("span");
    status.className = `admin-clinic-status${item.is_published ? " is-published" : ""}`;
    status.textContent = item.is_published ? "Publicada" : "Rascunho";
    const title = document.createElement("h3");
    title.textContent = item.name;
    const location = document.createElement("p");
    location.textContent = [item.address, [item.city, item.state].filter(Boolean).join(" — ")].filter(Boolean).join(" · ");
    const description = document.createElement("p");
    description.textContent = item.description;
    card.append(status, title, location, description);
    if (item.phone) {
      const phone = document.createElement("p");
      phone.textContent = `Telefone: ${item.phone}`;
      card.appendChild(phone);
    }
    target.appendChild(card);
  });
}

async function loadClinics() {
  const feedback = $("#clinicFeedback");
  setFeedback(feedback, "Carregando clínicas...");
  const result = await listAdminClinics();
  if (result.error || !Array.isArray(result.data)) {
    console.error("[Admin] Não foi possível carregar as clínicas.", result.error);
    setFeedback(feedback, "Não foi possível carregar a lista. Confira sua conexão e tente novamente.", true);
    return;
  }
  showClinicList(result.data);
  setFeedback(feedback, "");
}

async function refreshAccess(session) {
  const currentRefresh = ++refreshId;
  const authenticated = Boolean(session?.user);
  if (authPanel) authPanel.hidden = authenticated;
  if (accessPanel) accessPanel.hidden = !authenticated;
  if (clinicPanel) clinicPanel.hidden = true;
  if (clinicListPanel) clinicListPanel.hidden = true;
  if (promotionInstructions) promotionInstructions.hidden = true;
  if (!authenticated) return;

  const message = $("#accessMessage");
  if (!isSupabaseReady()) {
    setFeedback(message, "Configure as variáveis públicas do Supabase para usar o painel.", true);
    return;
  }

  setFeedback(message, "Verificando autorização administrativa...");
  const result = await isCurrentUserAdmin();
  if (currentRefresh !== refreshId) return;
  if (result.error) {
    console.error("[Admin] Não foi possível verificar a autorização.", result.error);
    setFeedback(message, "Não foi possível verificar seu acesso. Confira a configuração do Supabase e tente novamente.", true);
    return;
  }
  if (!result.data) {
    setFeedback(message, "Sua conta ainda não tem autorização para administrar clínicas.");
    if (promotionInstructions) promotionInstructions.hidden = false;
    return;
  }

  setFeedback(message, `Acesso administrativo autorizado para ${session.user.email}.`);
  if (clinicPanel) clinicPanel.hidden = false;
  if (clinicListPanel) clinicListPanel.hidden = false;
  await loadClinics();
}

function initAdmin() {
  const authForm = $("#adminAuthForm");
  const emailInput = $("#adminEmail");
  const passwordInput = $("#adminPassword");
  const authFeedback = $("#authFeedback");
  const clinicForm = $("#clinicForm");
  const publishInput = $("#clinicPublished");
  const verifiedAtInput = $("#clinicVerifiedAt");

  if (!isSupabaseReady()) {
    setFeedback(authFeedback, "O Supabase ainda não está configurado. Configure SUPABASE_URL e SUPABASE_ANON_KEY.", true);
  }

  if (authForm) authForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!emailInput || !passwordInput || !isSupabaseReady()) return;
    const result = await signIn(emailInput.value.trim(), passwordInput.value);
    if (result.error) {
      setFeedback(authFeedback, result.error.message || "Não foi possível entrar.", true);
      return;
    }
    setFeedback(authFeedback, "Login realizado. Verificando permissões...");
    await refreshAccess(result.data.session);
  });

  const signUpButton = $("#adminSignUp");
  if (signUpButton) signUpButton.addEventListener("click", async () => {
    if (!emailInput || !passwordInput || !isSupabaseReady()) return;
    if (passwordInput.value.length < 8) {
      setFeedback(authFeedback, "Use uma senha com pelo menos 8 caracteres.", true);
      return;
    }
    const result = await signUp(emailInput.value.trim(), passwordInput.value);
    if (result.error) {
      setFeedback(authFeedback, result.error.message || "Não foi possível criar a conta.", true);
      return;
    }
    if (result.data.session) {
      setFeedback(authFeedback, "Conta criada. A autorização administrativa ainda precisa ser concedida pelo Supabase.");
      await refreshAccess(result.data.session);
    } else {
      setFeedback(authFeedback, "Conta criada. Confirme o e-mail, entre e siga as instruções para solicitar acesso administrativo.");
    }
  });

  const signOutButton = $("#adminSignOut");
  if (signOutButton) signOutButton.addEventListener("click", async () => {
    const result = await signOut();
    if (result.error) {
      setFeedback($("#accessMessage"), result.error.message || "Não foi possível sair.", true);
      return;
    }
    setFeedback(authFeedback, "Você saiu da sua conta.");
    await refreshAccess(null);
  });

  if (clinicForm) clinicForm.addEventListener("submit", async event => {
    event.preventDefault();
    const feedback = $("#clinicFeedback");
    if (!publishInput || !verifiedAtInput) return;
    if (publishInput.checked && !verifiedAtInput.value) {
      setFeedback(feedback, "Informe a data de verificação antes de publicar.", true);
      verifiedAtInput.focus();
      return;
    }

    const formData = new FormData(clinicForm);
    const website = String(formData.get("website") || "").trim();
    if (website) {
      try {
        const parsedWebsite = new URL(website);
        if (parsedWebsite.protocol !== "http:" && parsedWebsite.protocol !== "https:") throw new Error("Protocolo inválido");
      } catch {
        setFeedback(feedback, "Informe um site válido começando com https:// ou http://.", true);
        $("#clinicWebsite")?.focus();
        return;
      }
    }

    const result = await createClinic({
      name: String(formData.get("name")).trim(),
      address: String(formData.get("address")).trim(),
      city: String(formData.get("city")).trim(),
      state: String(formData.get("state") || "").trim().toUpperCase() || null,
      description: String(formData.get("description")).trim(),
      phone: String(formData.get("phone") || "").trim() || null,
      website: website || null,
      is_published: publishInput.checked,
      verified_at: publishInput.checked ? verifiedAtInput.value : null
    });

    if (result.error) {
      console.error("[Admin] Não foi possível cadastrar a clínica.", result.error);
      setFeedback(feedback, result.error.message || "Não foi possível cadastrar a clínica. Confira sua autorização.", true);
      return;
    }

    clinicForm.reset();
    setFeedback(feedback, "Clínica cadastrada com sucesso.");
    await loadClinics();
  });

  const refreshButton = $("#refreshClinics");
  if (refreshButton) refreshButton.addEventListener("click", loadClinics);

  getSession().then(refreshAccess);
  const authListener = onAuthStateChange((_event, session) => {
    window.setTimeout(() => refreshAccess(session), 0);
  });
  window.addEventListener("beforeunload", () => authListener?.data?.subscription?.unsubscribe?.());
}

document.addEventListener("DOMContentLoaded", initAdmin);
