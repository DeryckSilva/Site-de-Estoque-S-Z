# Mapa 3D de Estoque - base v1

Arquivo unico: `index.html` (Three.js r128 via CDN, precisa de internet na 1a abertura).
Abra com duplo clique no navegador. Os dados ficam no navegador (localStorage) e podem ser exportados/importados em CSV.

## Estrutura
- 10 estantes (E01..E10) x 6 prateleiras (P1..P6, 30 cm cada, P1 = mais baixa), uma parede.
- Endereco = `E03-P4`. Cada prateleira comporta 3 itens (constante `SLOTS`).

## Modelo de dados (para ligar a dados reais)
`{ id, sku, name, cat, qty, unit, expiry:'YYYY-MM-DD'|'', entry:'YYYY-MM-DD', abc:'A|B|C', loc:'E03-P4' }`
Funcoes para trocar: `loadItems()` / `saveItems()`. O resto da tela le so o array `items`.

## Para o Google AI Studio (Build)
Cole o index.html e peca, por exemplo:
- "Salvar os dados num Google Sheets / Firebase em vez de localStorage"
- "Leitura de codigo de barras pela camera do celular para achar a prateleira"
- "Historico de movimentacoes e login por usuario"

## Recursos da v1
KPIs, cor por categoria / curva ABC / validade / tempo parado / ocupacao, busca (produto, SKU, endereco),
clique na prateleira para ver, adicionar, mover e remover itens, vista frontal, tour, CSV.
