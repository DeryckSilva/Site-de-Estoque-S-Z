# Mapeamento de Produção & Estoque

Aplicação web para mapeamento de estoque, pedidos comprometidos e entregas de equipamentos para produção.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Para testar o WMS compartilhado localmente, crie um arquivo `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Sem essas variáveis, o app usa o armazenamento local do navegador.

## Publicação permanente no GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site automaticamente no GitHub Pages quando há um push para `main`. Também é possível iniciar a publicação manualmente pela aba **Actions**.

1. Envie este projeto para um repositório no GitHub.
2. Para sincronizar o WMS entre usuários, crie um projeto Supabase e execute [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor.
3. Em **Project Settings → API**, copie a Project URL e a chave `anon` (publicável no navegador).
4. No GitHub, acesse **Settings → Secrets and variables → Actions → Variables** e crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com esses valores.
5. Em **Settings → Pages**, escolha **GitHub Actions** como origem; depois envie as alterações para a branch `main` ou inicie o workflow manualmente pela aba **Actions**.
6. Acesse o endereço exibido em **Settings → Pages**.

O workflow compila o código deste repositório em `dist` e o hospeda no GitHub Pages; o site não depende de um computador ou túnel local ligado. Sem as variáveis Supabase, os dados continuam sendo salvos somente no navegador. Com elas, o WMS e a planta 3D compartilham os dados em tempo real.

**Atenção:** o acesso configurado em `supabase/schema.sql` permite que qualquer pessoa com o link público leia e altere o estoque compartilhado, sem login. Use esse modo somente se esse nível de acesso for aceitável para a empresa.
