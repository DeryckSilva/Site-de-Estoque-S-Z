# Mapeamento de Produção & Estoque

Aplicação web para mapeamento de estoque, pedidos comprometidos e entregas de equipamentos para produção.

No **Mapeamento de Produção**, itens adicionados manualmente podem ser excluídos e **Baixar Excel** exporta o estoque agrupado junto com o mini-relatório de chips. Os valores do mini-relatório são editáveis e ficam salvos no navegador.

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

O script `pickup-signatures.sql` também habilita a lista compartilhada de retiradas e a exclusão permanente de qualquer registro por qualquer visitante, sem login. A exclusão invalida o QR.

Na aba **Retirada pelo tablet**, a Produção pode localizar uma retirada pendente pelo pedido ou cliente e abrir diretamente a página de conferência e assinatura, sem escanear o QR. Os registros precisam ter sido criados previamente na aba **Assinatura da retirada**; após assinados, deixam de aparecer como pendentes no painel do tablet.

### Impressão direta de etiquetas Zebra

Os botões de impressão enviam uma única etiqueta ZPL em pé (65 × 95 mm), com a composição horizontal da prévia girada 90° para caber na etiqueta, velocidade 4 e obscuridade 30. Não usam a janela de impressão do navegador.

O SDK JavaScript `BrowserPrint-3.1.250.min.js`, obtido do pacote oficial da Zebra, já está incluído em `public/vendor`. Em cada computador que imprime, instale e mantenha o Zebra Browser Print em execução. **Imprimir etiqueta Zebra (USB)** usa a impressora padrão do serviço; **Imprimir etiqueta Zebra (Wi-Fi · ZEBRA-ZD)** localiza a impressora de rede pelo nome `ZEBRA-ZD`, que deve estar conectada à rede SeZ e visível no Zebra Browser Print. A impressão não pode ser encaminhada diretamente do GitHub Pages à impressora sem esse serviço local. Se o SDK, o serviço ou a impressora de rede não estiver disponível, a tela informa a causa e não apresenta um falso aviso de sucesso.

**Atenção:** `supabase/schema.sql` configura `warehouse_state` e a lista de retiradas para leitura e alteração públicas, sem login. Qualquer pessoa com acesso ao site pode consultar e modificar o estoque, as movimentações e os registros de retirada. Execute o schema completo somente se esse nível de acesso for aceitável para a empresa.
