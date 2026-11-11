# Mapeamento de Produção & Estoque

Aplicação web para mapeamento de estoque, pedidos comprometidos e entregas de equipamentos para produção.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Para compartilhar campanhas de retirada entre celulares, crie um arquivo `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. A conexão do QR é isolada: o estoque continua local por padrão. O WMS só usa banco compartilhado com `VITE_SHARED_WMS_URL` e `VITE_SHARED_WMS_ANON_KEY`.

## Publicação permanente no GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site automaticamente no GitHub Pages quando há um push para `main`. Também é possível iniciar a publicação manualmente pela aba **Actions**.

1. Envie este projeto para um repositório no GitHub.
2. Crie um projeto Supabase e execute [`supabase/pickup-signatures.sql`](./supabase/pickup-signatures.sql) no SQL Editor. Se o projeto já existir, execute o script novamente para criar as funções e a tabela isolada das assinaturas.
3. Em **Project Settings → API Keys**, copie a Project URL e a **Publishable key** (pública, própria para o navegador). Nunca use a Secret key.
4. No GitHub, acesse **Settings → Secrets and variables → Actions → Variables** e crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com esses valores.
5. Em **Settings → Pages**, escolha **GitHub Actions** como origem; depois envie as alterações para a branch `main` ou inicie o workflow manualmente pela aba **Actions**.
6. Acesse o endereço exibido em **Settings → Pages**.

O workflow compila o código deste repositório em `dist` e o hospeda no GitHub Pages; o site não depende de um computador ou túnel local ligado. As variáveis Supabase são incorporadas durante a compilação. Depois de configurá-las, publique novamente e gere novos QR Codes: campanhas criadas anteriormente sem Supabase existem apenas no navegador que as criou.

As assinaturas usam uma tabela separada. O acesso direto a ela é bloqueado; as funções públicas recebem os IDs UUID solicitados. O QR funciona como uma credencial: qualquer pessoa que tenha o link pode consultar aquela campanha e, enquanto estiver pendente, registrar uma única assinatura da Produção. Depois de assinada, a página fica somente para consulta; não há assinatura da Logística nem substituição da assinatura.

O acesso ao QR é público por UUID: qualquer pessoa com o link pode consultar a campanha pendente e tentar registrar a única assinatura da Produção; após a assinatura, o banco rejeita novas assinaturas. Não há login. O estoque compartilhado não é ativado por essa configuração e permanece local.

**Atenção:** `supabase/schema.sql` também configura `warehouse_state` para leitura e alteração públicas, sem login. Não execute esse schema completo para habilitar somente os QR Codes; use o arquivo `pickup-signatures.sql`. Só ative o WMS compartilhado se esse nível de acesso for aceitável para a empresa.
