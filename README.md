# Mapeamento de Produção & Estoque

Aplicação web para mapeamento de estoque, pedidos comprometidos e entregas de equipamentos para produção.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Para compartilhar campanhas de retirada entre celulares, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Para desenvolvimento local, coloque-as em `.env.local`. O WMS pode usar `VITE_SHARED_WMS_URL` e `VITE_SHARED_WMS_ANON_KEY`; no deploy do GitHub Pages, esses valores usam como fallback as variáveis do QR quando os valores específicos do WMS não estiverem definidos.

## Publicação permanente no GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site automaticamente no GitHub Pages quando há um push para `main`. Também é possível iniciar a publicação manualmente pela aba **Actions**.

1. Envie este projeto para um repositório no GitHub.
2. Crie um projeto Supabase e execute o script correspondente no SQL Editor: `pickup-signatures.sql` para retiradas, ou `schema.sql` para compartilhar também o estoque e as movimentações. Se o projeto já existir, execute novamente o script escolhido para aplicar as funções e tabelas.
3. Em **Project Settings → API Keys**, copie a Project URL e a **Publishable key** (pública, própria para o navegador). Nunca use a Secret key.
4. No GitHub, acesse **Settings → Secrets and variables → Actions → Variables** e crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com esses valores.
5. Em **Settings → Pages**, escolha **GitHub Actions** como origem; depois envie as alterações para a branch `main` ou inicie o workflow manualmente pela aba **Actions**.
6. Acesse o endereço exibido em **Settings → Pages**.

O workflow compila o código deste repositório em `dist` e o hospeda no GitHub Pages; o site não depende de um computador ou túnel local ligado. As variáveis Supabase são incorporadas durante a compilação. Depois de configurá-las, publique novamente e gere novos QR Codes: campanhas criadas anteriormente sem Supabase existem apenas no navegador que as criou.

As assinaturas usam uma tabela separada. O acesso direto a ela é bloqueado; as funções públicas recebem os IDs UUID solicitados. O QR funciona como uma credencial: qualquer pessoa que tenha o link pode consultar aquela campanha e, enquanto estiver pendente, registrar uma única assinatura da Produção. Depois de assinada, a página fica somente para consulta; não há assinatura da Logística nem substituição da assinatura.

O acesso ao QR é público por UUID: qualquer pessoa com o link pode consultar a campanha pendente e tentar registrar a única assinatura da Produção; após a assinatura, o banco rejeita novas assinaturas. Não há login. A lista compartilhada de retiradas também fica visível para visitantes do site.

O script `pickup-signatures.sql` também habilita a lista compartilhada de retiradas e a exclusão permanente de retiradas recém-criadas com um token privado mantido somente no navegador da Produção. O token não faz parte do QR; retiradas criadas antes dessa alteração não podem ser apagadas por esse botão.

**Atenção:** `supabase/schema.sql` configura `warehouse_state` e a lista de retiradas para leitura e alteração públicas, sem login. Qualquer pessoa com acesso ao site pode consultar e modificar o estoque, as movimentações e os registros de retirada. Execute o schema completo somente se esse nível de acesso for aceitável para a empresa.
