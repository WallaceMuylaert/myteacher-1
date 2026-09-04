# 🔑 Guia de Configuração: Autenticação com Google (OAuth 2.0)

Este documento fornece o passo a passo completo para configurar e habilitar o **Login e Cadastro com a Conta Google** no **MyTeacherApp**, tanto em ambiente de desenvolvimento local quanto em produção.

---

## 📌 Visão Geral do Fluxo

```
[Usuário clica em "Continuar com o Google"]
                  │
                  ▼
[Frontend: redireciona para /auth/google no Backend]
                  │
                  ▼
[Backend: redireciona para tela de consentimento do Google]
                  │
                  ▼
[Usuário autoriza e Google redireciona para /auth/google/callback com ?code=...]
                  │
                  ▼
[Backend troca code por tokens e dados do perfil (email, nome, foto)]
                  │
                  ▼
[Backend busca ou cria conta (14 dias de teste grátis se novo) e gera JWT]
                  │
                  ▼
[Backend redireciona para /auth/callback?token=... no Frontend]
                  │
                  ▼
[Frontend armazena JWT no localStorage e entra no /dashboard]
```

---

## 🛠️ Passo a Passo: Configurando no Google Cloud Console

### 1. Criar ou Selecionar um Projeto
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. No menu superior, selecione a lista de projetos e clique em **"Novo Projeto"** (ex: `MyTeacherApp`).
3. Aguarde a criação e selecione o projeto criado.

---

### 2. Configurar a Tela de Consentimento OAuth (OAuth Consent Screen)
1. No menu lateral esquerdo, vá em **APIs e Serviços** > **Tela de consentimento OAuth**.
2. Escolha o tipo de usuário:
   - **Externo** (para permitir que qualquer professor com conta Google possa se cadastrar).
   - Clique em **Criar**.
3. Preencha as informações básicas do aplicativo:
   - **Nome do app**: `MyTeacherApp`
   - **E-mail para suporte do usuário**: Seu e-mail de contato.
   - **Logotipo do app**: (Opcional).
   - **Domínio do aplicativo**: Em produção, adicione `https://myteacherapp.com.br`.
   - **Dados de contato do desenvolvedor**: Seu e-mail.
4. Clique em **Salvar e continuar**.
5. Na etapa **Escopos (Scopes)**:
   - Clique em **Adicionar ou remover escopos**.
   - Selecione os escopos básicos:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Clique em **Atualizar** e depois em **Salvar e continuar**.
6. Na etapa **Usuários de teste** (enquanto o app estiver em modo de teste):
   - Adicione os e-mails do Google que você usará para testar o login local.
   - Clique em **Salvar e continuar**.

---

### 3. Criar as Credenciais (ID do Cliente OAuth 2.0)
1. No menu lateral, acesse **APIs e Serviços** > **Credenciais**.
2. Clique em **+ Criar credenciais** > **ID do cliente OAuth**.
3. Em **Tipo de aplicativo**, escolha **Aplicativo da Web**.
4. Defina um nome identificador (ex: `MyTeacher Web Client`).
5. Configure as URLs autorizadas:

#### A. Origens JavaScript autorizadas (Authorized JavaScript Origins):
*URLs de onde as requisições partem:*
- **Desenvolvimento local:**
  - `http://localhost:5273`
  - `http://localhost:5173`
  - `http://localhost:8501`
- **Produção:**
  - `https://myteacherapp.com.br`
  - `https://www.myteacherapp.com.br`

#### B. URIs de redirecionamento autorizados (Authorized Redirect URIs):
*URLs para onde o Google enviará o código de autorização após o usuário aprovar:*
- **Desenvolvimento local:**
  - `http://localhost:8501/auth/google/callback`
  - `http://localhost:8501/google/callback`
  - *(Se rodar backend fora do docker na porta 8500: `http://localhost:8500/auth/google/callback`)*
- **Produção:**
  - `https://myteacherapp.com.br/api/auth/google/callback`
  - `https://myteacherapp.com.br/auth/google/callback`

6. Clique em **Criar**.
7. Uma janela exibirá seu **ID do Cliente** e a **Chave Secreta do Cliente**. Copie ambos os valores.

---

## ⚙️ Configuração das Variáveis de Ambiente

Abra o seu arquivo `.env` (ou `.env.prod` em produção) na raiz do projeto e preencha as variáveis correspondentes:

### Exemplo para Desenvolvimento Local (`.env`):
```env
# Google OAuth
GOOGLE_CLIENT_ID=seu_client_id_aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=sua_client_secret_aqui
GOOGLE_CALLBACK_URL=http://localhost:8501/auth/google/callback
FRONTEND_URL=http://localhost:5273
```

### Exemplo para Produção (`.env.prod`):
```env
# Google OAuth
GOOGLE_CLIENT_ID=seu_client_id_aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=sua_client_secret_aqui
GOOGLE_CALLBACK_URL=https://myteacherapp.com.br/api/auth/google/callback
FRONTEND_URL=https://myteacherapp.com.br
```

---

## 🚀 Testando a Implementação

1. Inicie a aplicação com Docker Compose:
   ```powershell
   docker-compose up -d
   ```
2. Acesse a página de login em `http://localhost:5273/login` ou cadastro em `http://localhost:5273/register`.
3. Clique em **"Continuar com o Google"**.
4. Faça login na sua conta Google e aprove a autorização.
5. Você será redirecionado para o **Dashboard**, já autenticado e com seus dados (Nome, Foto, E-mail) carregados no sistema!

---

## ❓ Resolução de Problemas (Troubleshooting)

| Erro | Causa Provável | Solução |
| :--- | :--- | :--- |
| `redirect_uri_mismatch` (Google Error 400) | O URI de callback configurado no Google Console não bate exatamente com o `GOOGLE_CALLBACK_URL` do `.env`. | Verifique se a URL com porta (ex: `http://localhost:8501/auth/google/callback`) está cadastrada em *URIs de redirecionamento autorizados*. |
| `google_not_configured` | As variáveis `GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET` estão vazias no `.env`. | Preencha as chaves no `.env` e reinicie os containers (`docker-compose restart backend`). |
| `oauth_failed` | Falha na troca de tokens ou autorização cancelada pelo usuário. | Verifique se o secret do Google está correto e se o container do backend tem acesso à internet. |
| Usuário não autorizado / Acesso bloqueado | App em modo "Teste" no Google Console e o e-mail não foi adicionado na lista de testes. | Adicione o e-mail do usuário em *Tela de consentimento OAuth* > *Usuários de teste*, ou publique o app para produção. |
