export interface BaseOrder {
  id: string; // e.g. "3820-18092026-03"
  numPedido: string;
  dataSolicitacao: string;
  dataEnvio: string;
  cliente: string;
  cnpj?: string;
  comercial: string;
  contrato?: string;
  tipoNegocio: string; // "VENDA", "ASSISTÊNCIA", "ESTOQUE", "TROCA", "UPGRADE", "TESTE"
  tipoEntrega?: string; // "Correios", "Motoboy", "Entrega", "Retirada do Cliente", "Transportadora"
  tipoItem: 'Isca de carga' | 'Rastreador' | 'Smart Tags';
  
  // Model specifications
  operadora?: string; // "ESEYE", "VIVO", "ALLCOM", "CLARO", "TIM"
  carregador?: string;
  quantidadeCarregador?: number | string;
  geracao?: string; // "ST8410 (4G)", "ST4410G (4G)", "ST410G (2G)", etc.
  modeloVariacao?: string; // "Modelo Padrão", "Modelo Fina", "Modelo Imantada", etc.
  corVariacao?: string; // "Branca Padrão", "Marrom Padrão", "Preta Padrão", "Azul Padrão", "Preta C-imã", "Kraft", etc.
  quantidade: number;
  
  // Auto-detected mapping item ID corresponding to EQUIPMENT_ITEMS in Mapeamento
  mappedItemId: string;
  mappedItemName: string;
  
  observacao?: string;
  status: 'Aberto' | 'Em Produção' | 'Destinado' | 'Atendido';
  destinadoProducao?: number; // quantity delivered / destined to production
}
