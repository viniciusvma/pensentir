# Pensentir — site

Node + Express (Render) · Supabase (banco + imagens) · Instagram API oficial · Mercado Pago (link de pagamento).

- Site: `/`
- Painel: `/admin` (acessos, produtos, frases da roleta, lista VIP, links, token do Instagram)

## 1. Supabase
1. Crie o projeto.
2. **SQL Editor** → cole todo o `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copie a **URL** e a **chave secreta** (`service_role` ou `sb_secret_...`).

## 2. GitHub
```bash
git init && git add . && git commit -m "site pensentir"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pensentir.git
git push -u origin main
```

## 3. Render
**New → Web Service** → conecte o repositório.
- Build: `npm install`
- Start: `npm start`
- Variáveis de ambiente:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | URL do Supabase |
| `SUPABASE_SERVICE_KEY` | chave secreta do Supabase |
| `ADMIN_PASSWORD` | senha do painel |
| `SESSION_SECRET` | texto longo aleatório |

(Ou use **New → Blueprint**, que lê o `render.yaml`.)

## 4. Instagram (posts automáticos)
Precisa de conta profissional (Criador/Empresa).
1. developers.facebook.com → crie um app → caso de uso de Instagram.
2. **Instagram → API setup with Instagram business login → Generate token** → entre com a @pensentir.
3. Copie o token → `/admin` → Configurações → cole → **Salvar token** → **Testar conexão**.

O token vale 60 dias; o site renova sozinho a cada ~20 dias.

## 5. Ebook / Mercado Pago
Crie um **link de pagamento** no Mercado Pago e cole no produto em `/admin → Produtos`.
Entrega do PDF por enquanto é manual (o comprador aparece no seu painel do Mercado Pago).

## Rodar local
```bash
cp .env.example .env   # preencha
npm install
npm run dev            # http://localhost:3000
```

## Imagens
`public/img/logo.png` e `favicon.png` foram recortados do print do perfil (baixa resolução). Troque pelo arquivo original do logo mantendo o mesmo nome.
