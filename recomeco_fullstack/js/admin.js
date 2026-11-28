import {
  createClinic,
  deleteClinic,
  deleteTestimonial,
  getSession,
  isCurrentUserAdmin,
  isSupabaseReady,
  listAdminClinics,
  listAdminTestimonials,
  onAuthStateChange,
  setTestimonialPublished,
  signIn,
  signOut,
  signUp
} from "./supabase-client.js";

const $ = selector => document.querySelector(selector);
const authPanel = $("#authPanel");
const accessPanel = $("#accessPanel");
const clinicPanel = $("#clinicPanel");
const clinicListPanel = $("#clinicListPanel");
const testimonialPanel = $("#testimonialPanel");
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
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn btn-danger btn-small admin-delete-button";
    deleteButton.type = "button";
    deleteButton.dataset.clinicId = item.id;
    deleteButton.dataset.clinicName = item.name;
    deleteButton.textContent = "Excluir permanentemente";
    card.appendChild(deleteButton);
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
    return false;
  }
  showClinicList(result.data);
  setFeedback(feedback, "");
  return true;
}

function showTestimonials(items) {
  const target = $("#adminTestimonialList");
  if (!target) return;
  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "admin-empty";
    empty.textContent = "Ainda não há depoimentos recebidos.";
    target.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "admin-testimonial-card";
    const status = document.createElement("span");
    status.className = `admin-clinic-status${item.is_published ? " is-published" : ""}`;
    status.textContent = item.is_published ? "Publicado" : "Aguardando avaliação";
    const author = document.createElement("h3");
    author.textContent = item.name;
    const content = document.createElement("p");
    content.className = "admin-testimonial-content";
    content.textContent = item.content;
    const button = document.createElement("button");
    button.className = item.is_published ? "btn btn-outline btn-small" : "btn btn-primary btn-small";
    button.type = "button";
    button.dataset.testimonialId = item.id;
    button.dataset.publish = String(!item.is_published);
    button.textContent = item.is_published ? "Retirar do site" : "Aprovar publicação";
    const actions = document.createElement("div");
    actions.className = "admin-testimonial-actions";
    actions.appendChild(button);
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn btn-danger btn-small admin-delete-button";
    deleteButton.type = "button";
    deleteButton.dataset.testimonialId = item.id;
    deleteButton.dataset.testimonialName = item.name;
    deleteButton.textContent = "Excluir permanentemente";
    actions.appendChild(deleteButton);
    card.append(status, author, content, actions);
    target.appendChild(card);
  });
}

async function loadTestimonials() {
  const feedback = $("#testimonialAdminFeedback");
  setFeedback(feedback, "Carregando depoimentos...");
  const result = await listAdminTestimonials();
  if (result.error || !Array.isArray(result.data)) {
    console.error("[Admin] Não foi possível carregar os depoimentos.", result.error);
    setFeedback(feedback, "Não foi possível carregar os depoimentos. Confira sua conexão e tente novamente.", true);
    return false;
  }
  showTestimonials(result.data);
  setFeedback(feedback, "");
  return true;
}

async function refreshAccess(session) {
  const currentRefresh = ++refreshId;
  const authenticated = Boolean(session?.user);
  if (authPanel) authPanel.hidden = authenticated;
  if (accessPanel) accessPanel.hidden = !authenticated;
  if (clinicPanel) clinicPanel.hidden = true;
  if (clinicListPanel) clinicListPanel.hidden = true;
  if (testimonialPanel) testimonialPanel.hidden = true;
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
    setFeedback(message, "Sua conta ainda não tem autorização para administrar clínicas e depoimentos.");
    if (promotionInstructions) promotionInstructions.hidden = false;
    return;
  }

  setFeedback(message, `Acesso administrativo autorizado para ${session.user.email}.`);
  if (clinicPanel) clinicPanel.hidden = false;
  if (clinicListPanel) clinicListPanel.hidden = false;
  if (testimonialPanel) testimonialPanel.hidden = false;
  await Promise.all([loadClinics(), loadTestimonials()]);
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

  const clinicList = $("#adminClinicList");
  if (clinicList) clinicList.addEventListener("click", async event => {
    const button = event.target.closest("button[data-clinic-id]");
    if (!button || !window.confirm(`Excluir permanentemente a clínica "${button.dataset.clinicName}"? Esta ação não pode ser desfeita.`)) return;
    button.disabled = true;
    const result = await deleteClinic(button.dataset.clinicId);
    if (result.error) {
      console.error("[Admin] Não foi possível excluir a clínica.", result.error);
      setFeedback($("#clinicFeedback"), "Não foi possível excluir a clínica. Confira sua autorização e tente novamente.", true);
      button.disabled = false;
      return;
    }
    if (await loadClinics()) {
      setFeedback($("#clinicFeedback"), "Clínica excluída permanentemente.");
    }
  });

  const refreshTestimonialsButton = $("#refreshTestimonials");
  if (refreshTestimonialsButton) refreshTestimonialsButton.addEventListener("click", loadTestimonials);

  const testimonialList = $("#adminTestimonialList");
  if (testimonialList) testimonialList.addEventListener("click", async event => {
    const deleteButton = event.target.closest("button[data-testimonial-id]:not([data-publish])");
    if (deleteButton) {
      if (!window.confirm(`Excluir permanentemente o depoimento de "${deleteButton.dataset.testimonialName}"? Esta ação não pode ser desfeita.`)) return;
      deleteButton.disabled = true;
      const deleteResult = await deleteTestimonial(deleteButton.dataset.testimonialId);
      if (deleteResult.error) {
        console.error("[Admin] Não foi possível excluir o depoimento.", deleteResult.error);
        setFeedback($("#testimonialAdminFeedback"), "Não foi possível excluir o depoimento. Confira sua autorização e tente novamente.", true);
        deleteButton.disabled = false;
        return;
      }
      if (await loadTestimonials()) {
        setFeedback($("#testimonialAdminFeedback"), "Depoimento excluído permanentemente.");
      }
      return;
    }

    const button = event.target.closest("button[data-testimonial-id][data-publish]");
    if (!button) return;
    button.disabled = true;
    const shouldPublish = button.dataset.publish === "true";
    const result = await setTestimonialPublished(button.dataset.testimonialId, shouldPublish);
    if (result.error) {
      console.error("[Admin] Não foi possível atualizar o depoimento.", result.error);
      setFeedback($("#testimonialAdminFeedback"), "Não foi possível atualizar o depoimento. Confira sua autorização e tente novamente.", true);
      button.disabled = false;
      return;
    }
    if (await loadTestimonials()) {
      setFeedback($("#testimonialAdminFeedback"), shouldPublish ? "Depoimento aprovado e publicado." : "Depoimento retirado do site.");
    }
  });

  getSession().then(refreshAccess);
  const authListener = onAuthStateChange((_event, session) => {
    window.setTimeout(() => refreshAccess(session), 0);
  });
  window.addEventListener("beforeunload", () => authListener?.data?.subscription?.unsubscribe?.());
}

document.addEventListener("DOMContentLoaded", initAdmin);
