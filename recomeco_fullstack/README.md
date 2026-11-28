# Recomeço — Full-Stack 2.0

Projeto acadêmico de plataforma informativa e acolhedora com frontend modular, Supabase, Netlify Functions e API Python para recomendação de conteúdos.

## Arquitetura

- Frontend: HTML5, Tailwind CSS via CDN e JavaScript ES Modules.
- Supabase: autenticação e PostgreSQL com RLS.
- Chatbot: Netlify Function em `netlify/functions/chat.mjs`; a chave `AI_API_KEY` fica apenas no servidor.
- Recomendador: FastAPI + TF-IDF + similaridade de cosseno.
- Deploy: Netlify para frontend e função; hospede a API Python separadamente.

## 1. Requisitos

- Node.js 18 ou superior.
- Conta/projeto Supabase.
- Conta Netlify.
- Chave de API de IA compatível com a API Responses da OpenAI (ou adapte o endpoint no arquivo da Function).
- Python 3.10 ou superior para a API recomendadora.

## 2. Configurar Supabase

1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Execute todo o arquivo `schema.sql`.
4. Em Project Settings > API, copie Project URL e a chave pública anon/publishable.
5. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` como variáveis de ambiente de build no Netlify.

A chave anon é pública e pode ficar no frontend somente com RLS habilitado. Nunca coloque a chave `service_role` no navegador.

## 3. Configurar chatbot

No Netlify, configure:
- `AI_API_KEY`: chave privada do provedor.
- `AI_MODEL`: modelo habilitado para sua conta, opcional.

A Function usa `https://api.openai.com/v1/responses`. Se utilizar outro provedor, adapte URL, autenticação e formato de resposta em `netlify/functions/chat.mjs`.

A Function não armazena conversas. O histórico mantido pelo widget fica apenas em memória na sessão atual do navegador e é enviado para contextualizar a solicitação.

## 4. Configurar recomendador Python

Dentro de `api-recomendador`:

```bash
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Execute localmente:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Teste:
- `GET http://localhost:8000/health`
- `POST http://localhost:8000/recommend`
- JSON: `{"query":"apoio para familiares","limit":3}`

Configure `RECOMMENDER_API_URL` no Netlify com a URL pública da API. Configure `ALLOWED_ORIGINS` na hospedagem Python com o domínio exato do site e, se necessário, o domínio de preview Netlify. O backend aceita também subdomínios `*.netlify.app` pelo regex de CORS.

## 5. Rodar localmente

Instale dependências na raiz:

```bash
npm install
```

Copie `.env.example` para `.env` na raiz do repositório e preencha as variáveis públicas do Supabase e URL do recomendador. O comando `npm run dev`, executado nesta pasta, gera a configuração do frontend antes de iniciar o Netlify Dev. Somente URL e chave pública do Supabase são incluídas no frontend; nunca use `service_role` nesse arquivo.

Rode:

```bash
npm run dev
```

Acesse a URL local exibida pelo Netlify CLI (normalmente `http://localhost:8888`). Assim as Netlify Functions também ficam disponíveis.

**Live Server:** pode servir a interface estática, mas não executa Netlify Functions nem injeta variáveis de ambiente do build. O chat retornará erro de endpoint até você usar `netlify dev` ou publicar no Netlify. O diretório e a jornada demonstrativa continuam funcionando localmente.

## 6. Deploy no Netlify

1. Envie o projeto ao GitHub sem `.env`, `node_modules` ou chaves.
2. Importe o repositório no Netlify.
3. Build command: `npm run build`.
4. Publish directory: `.`.
5. Adicione `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RECOMMENDER_API_URL`, `AI_API_KEY` e opcionalmente `AI_MODEL` em Environment variables.
6. Faça deploy.

O script `scripts/write-config.mjs` gera `js/runtime-config.js` durante o build. Ele só inclui URL e chave pública do Supabase e URL pública do recomendador. A chave da IA nunca é incluída nesse arquivo.

## 7. Cadastrar clínicas e outros serviços

A página administrativa fica em `admin.html`. Para habilitá-la em um projeto Supabase já configurado:

1. Execute `admin-setup.sql` no SQL Editor. Ele cria a tabela de administradores, habilita o envio e a moderação de depoimentos e configura as políticas RLS; não concede acesso automaticamente a nenhuma conta.
2. Na página `admin.html`, crie a conta com seu e-mail e senha. Confirme o e-mail, se o Supabase exigir.
3. Como proprietário do projeto, autorize sua conta no SQL Editor, trocando o e-mail abaixo pelo usado no cadastro:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users
   where lower(email) = lower('seu-email@exemplo.com')
   on conflict (user_id) do nothing;
   ```

4. Entre novamente em `admin.html`. Cadastre as clínicas; marque “Publicar no diretório” somente após validar as informações e informar a data de verificação. Nas listas de clínicas e de depoimentos, use “Excluir permanentemente” para apagar do banco os registros que não deseja manter. Na seção “Depoimentos recebidos”, também é possível aprovar ou retirar cada publicação.

A autorização é conferida também pelas políticas RLS do banco, não apenas pela interface. Contas comuns não podem se promover nem cadastrar clínicas ou publicar depoimentos. Depoimentos enviados pelo site ficam pendentes e somente os aprovados são exibidos publicamente. Para uma instalação nova, `schema.sql` já contém as tabelas e políticas administrativas e de moderação.

## 8. Privacidade e segurança

- Não colete dados sensíveis sem finalidade legítima, transparência, base legal e controles compatíveis com a LGPD.
- Não use o chatbot ou o recomendador para diagnosticar, classificar risco clínico ou recomendar tratamento.
- O chatbot não é monitorado por equipe de emergência e não oferece atendimento humano 24h.
- Não envie diário, dados de saúde ou identificadores ao provedor de IA.
- A jornada salva localmente somente marcações de atividades no navegador.
- Para urgência médica, oriente SAMU 192. CVV 188 é apoio emocional, não serviço de emergência médica.
- Revise materiais de saúde com profissionais qualificados e fontes oficiais.
- Antes de produção, configure rate limiting, monitoramento, política de privacidade, termos de uso, processo de exclusão de conta/dados e revisão de segurança.

## 9. Limites desta entrega

Os arquivos implementam o fluxo técnico e protótipo. Para produção real, ainda é necessário:
- inserir e validar o diretório de serviços;
- publicar e testar a API Python;
- configurar credenciais e domínios;
- revisar a política de privacidade e termos;
- realizar testes de segurança, acessibilidade, carga e integração.
