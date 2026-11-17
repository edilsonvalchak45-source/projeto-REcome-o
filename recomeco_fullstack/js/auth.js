import { getSession, signIn, signOut, signUp, onAuthStateChange, isSupabaseReady } from "./supabase-client.js";

export function initAuth() {
  const dialog = document.getElementById("authDialog");
  const openButton = document.getElementById("authOpen");
  const closeButton = document.getElementById("authClose");
  const form = document.getElementById("authForm");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const feedback = document.getElementById("authFeedback");
  const signInButton = document.getElementById("signInButton");
  const signUpButton = document.getElementById("signUpButton");
  const signOutButton = document.getElementById("signOutButton");
  if (!dialog || !openButton || !form) return;

  const showFeedback = message => { if (feedback) feedback.textContent = message; };
  const open = () => {
    if (!isSupabaseReady()) showFeedback("A autenticação ainda não foi configurada. Preencha as variáveis públicas do Supabase.");
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  };
  openButton.addEventListener("click", open);
  if (closeButton) closeButton.addEventListener("click", () => dialog.close());

  const refresh = async session => {
    const signedIn = Boolean(session?.user);
    openButton.textContent = signedIn ? "Minha conta" : "Entrar";
    if (signOutButton) signOutButton.hidden = !signedIn;
    if (signInButton) signInButton.hidden = signedIn;
    if (signUpButton) signUpButton.hidden = signedIn;
  };
  getSession().then(refresh);
  const authListener = onAuthStateChange((_event, session) => refresh(session));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!emailInput || !passwordInput) return;
    const result = await signIn(emailInput.value.trim(), passwordInput.value);
    if (result.error) showFeedback(result.error.message || result.error.toString());
    else {
      showFeedback("Login realizado com sucesso.");
      await refresh(result.data.session);
    }
  });

  if (signUpButton) signUpButton.addEventListener("click", async () => {
    if (!emailInput || !passwordInput) return;
    if (passwordInput.value.length < 8) {
      showFeedback("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    const result = await signUp(emailInput.value.trim(), passwordInput.value);
    if (result.error) showFeedback(result.error.message || result.error.toString());
    else showFeedback("Cadastro iniciado. Verifique seu e-mail para confirmar a conta, se a confirmação estiver habilitada.");
  });

  if (signOutButton) signOutButton.addEventListener("click", async () => {
    const result = await signOut();
    if (result.error) showFeedback(result.error.message || "Não foi possível sair.");
    else {
      showFeedback("Você saiu da sua conta.");
      await refresh(null);
    }
  });

  window.addEventListener("beforeunload", () => authListener?.data?.subscription?.unsubscribe?.());
}
