# Mapeamento de Produção & Estoque

Aplicação web para mapeamento de estoque, pedidos comprometidos e entregas de equipamentos para produção.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Para testar o WMS compartilhado localmente, crie um arquivo `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Sem essas variáveis, o app usa o armazenamento local do navegador; nesse modo, não é possível gerar QR Codes que abram em outro dispositivo.

## Publicação permanente no GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site automaticamente no GitHub Pages quando há um push para `main`. Também é possível iniciar a publicação manualmente pela aba **Actions**.

1. Envie este projeto para um repositório no GitHub.
2. Crie um projeto Supabase e execute [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor. Se o projeto já existir, execute o script novamente para criar as funções e a tabela isolada das assinaturas.
3. Em **Project Settings → API**, copie a Project URL e a chave `anon` (publicável no navegador).
4. No GitHub, acesse **Settings → Secrets and variables → Actions → Variables** e crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com esses valores.
5. Em **Settings → Pages**, escolha **GitHub Actions** como origem; depois envie as alterações para a branch `main` ou inicie o workflow manualmente pela aba **Actions**.
6. Acesse o endereço exibido em **Settings → Pages**.

O workflow compila o código deste repositório em `dist` e o hospeda no GitHub Pages; o site não depende de um computador ou túnel local ligado. As variáveis Supabase são incorporadas durante a compilação. Depois de configurá-las, publique novamente e gere novos QR Codes: campanhas criadas anteriormente sem Supabase existem apenas no navegador que as criou.

As assinaturas usam uma tabela separada. O acesso direto a ela é bloqueado; as funções públicas recebem os IDs UUID solicitados. O QR funciona como uma credencial: qualquer pessoa que tenha o link pode consultar aquela campanha e registrar uma assinatura.

**Atenção:** o acesso configurado para `warehouse_state` em `supabase/schema.sql` permite que qualquer pessoa com a chave pública leia e altere o estoque compartilhado, sem login. Use esse modo somente se esse nível de acesso for aceitável para a empresa.
