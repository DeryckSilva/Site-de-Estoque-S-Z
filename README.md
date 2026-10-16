# Mapeamento de Produção & Estoque

Aplicação web para mapeamento de estoque, pedidos comprometidos e entregas para produção.

## Publicação

O GitHub Actions compila e publica automaticamente o site no GitHub Pages a cada atualização da branch `main`.

Acesse o app: https://derycksilva.github.io/Site-de-Estoque-S-Z/

## Código-fonte

O projeto está em `site-source.zip`. O workflow de publicação extrai o arquivo, instala as dependências com `npm ci`, compila com Vite e publica a pasta `dist`.
