import { EquipmentItem, EquipmentStockValues, OrderItem, SemPedidoEntry, EquipmentDeliveryEntry } from '../types/mapping';

export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  // ISCA 2G
  { id: '2g-dev', name: '2G (DEV)', group: 'ISCA 2G' },
  { id: 'queck-2g', name: 'Queck (2G)', group: 'ISCA 2G' },
  { id: 'queck-2g-sbat', name: 'Queck (2G S/BAT)', group: 'ISCA 2G' },

  // ISCA 4G
  { id: 'st-8410', name: 'ST-8410', group: 'ISCA 4G', aliases: ['ST8410 (4G)', '8410', 'ST-8410 (4G)'] },
  { id: '4g-dev', name: '4G (DEV)', group: 'ISCA 4G' },
  { id: 'queck-4g', name: 'Queck (4G)', group: 'ISCA 4G', aliases: ['ST4410G (4G)', 'ST-4410G'] },
  { id: 'queck-4g-sbat', name: 'Queck (4G S/BAT)', group: 'ISCA 4G' },
  { id: 'queck-4g-bat-3800', name: 'Queck (4G BAT 3.800)', group: 'ISCA 4G', aliases: ['Queck 3.800', 'Queck 3800'] },

  // TAGS
  { id: 'tag-card', name: 'TAG CARD', group: 'TAGS' },
  { id: 'tag-mini', name: 'TAG MINI', group: 'TAGS', aliases: ['Smart Tags', 'Smart Tag'] },

  // RASTREADORES
  { id: 'lt-32-pro', name: 'LT-32 - PRO', group: 'RASTREADORES', aliases: ['LT-32 PRO', 'LT32 PRO'] },
  { id: 'lt-32', name: 'LT-32', group: 'RASTREADORES', aliases: ['LT32'] },
  { id: 'st-8395', name: 'ST-8395', group: 'RASTREADORES' },
  { id: 'sg-bras', name: 'SG-BRAS', group: 'RASTREADORES' },
  { id: 'st-8310-um', name: 'ST-8310 UM', group: 'RASTREADORES' },
  { id: 'st-8380', name: 'ST-8380', group: 'RASTREADORES' },
  { id: 'st-340-ur', name: 'ST-340 UR', group: 'RASTREADORES', aliases: ['ST-340 UR+SG', 'ST-340 UR / SG'] },
  { id: 'st-310-u', name: 'ST-310 U', group: 'RASTREADORES', aliases: ['ST-310U', 'ST310U'] },
  { id: 'st-310-uc2', name: 'ST-310UC2', group: 'RASTREADORES', aliases: ['ST-310 UC2'] },
  { id: 'st-43', name: 'ST-43', group: 'RASTREADORES' },

  // INDISPONÍVEL
  { id: 'sz-isca-v2-1800', name: 'SZ ISCA V2 - 1.800', group: 'INDISPONÍVEL' },
  { id: 'sz-isca-v2-2800', name: 'SZ ISCA V2 - 2.800', group: 'INDISPONÍVEL' },
  { id: 'sz-isca-v2', name: 'SZ ISCA V2', group: 'INDISPONÍVEL' },
  { id: 'tag-mini-sz', name: 'TAG MINI S&Z', group: 'INDISPONÍVEL' },
  { id: 'tag-card-sz', name: 'TAG CARD S&Z', group: 'INDISPONÍVEL' },
];

export const INITIAL_STOCK_VALUES: Record<string, EquipmentStockValues> = {
  // ISCA 2G
  '2g-dev': { fisico: 204, emManutencao: 0, compraRealizada: 0 },
  'queck-2g': { fisico: 239, emManutencao: 0, compraRealizada: 0 },
  'queck-2g-sbat': { fisico: 27, emManutencao: 0, compraRealizada: 0 },

  // ISCA 4G
  'st-8410': { fisico: 50, emManutencao: 80, compraRealizada: 1199 },
  '4g-dev': { fisico: 89, emManutencao: 0, compraRealizada: 0 },
  'queck-4g': { fisico: 62, emManutencao: 0, compraRealizada: 0 },
  'queck-4g-sbat': { fisico: 9, emManutencao: 0, compraRealizada: 0 },
  'queck-4g-bat-3800': { fisico: 46, emManutencao: 0, compraRealizada: 0 },

  // TAGS
  'tag-card': { fisico: 46, emManutencao: 0, compraRealizada: 0 },
  'tag-mini': { fisico: 75, emManutencao: 1, compraRealizada: 0 },

  // RASTREADORES
  'lt-32-pro': { fisico: 72, emManutencao: 225, compraRealizada: 0 },
  'lt-32': { fisico: 18, emManutencao: 0, compraRealizada: 0 },
  'st-8395': { fisico: 12, emManutencao: 0, compraRealizada: 0 },
  'sg-bras': { fisico: 16, emManutencao: 0, compraRealizada: 0 },
  'st-8310-um': { fisico: 23, emManutencao: 0, compraRealizada: 0 },
  'st-8380': { fisico: 62, emManutencao: 0, compraRealizada: 50 },
  'st-340-ur': { fisico: 21, emManutencao: 0, compraRealizada: 0 },
  'st-310-u': { fisico: 41, emManutencao: 0, compraRealizada: 0 },
  'st-310-uc2': { fisico: 47, emManutencao: 0, compraRealizada: 0 },
  'st-43': { fisico: 78, emManutencao: 0, compraRealizada: 0 },

  // INDISPONÍVEL
  'sz-isca-v2-1800': { fisico: 1742, emManutencao: 10, compraRealizada: 0 },
  'sz-isca-v2-2800': { fisico: 1965, emManutencao: 0, compraRealizada: 0 },
  'sz-isca-v2': { fisico: 6248, emManutencao: 0, compraRealizada: 0 },
  'tag-mini-sz': { fisico: 995, emManutencao: 5, compraRealizada: 0 },
  'tag-card-sz': { fisico: 0, emManutencao: 0, compraRealizada: 0 },
};

// Bottom-left orders table matching screenshot exactly
export const INITIAL_ORDERS: OrderItem[] = [
  { id: 'ord-1', numPed: '3758-09092026-02', cliente: 'ABC CARGAS LTDA', quantidade: 2, itemId: 'st-8410' },
  { id: 'ord-2', numPed: '3775-11092026-TE1', cliente: 'BIOMEDICAL DISTRIBUTION MERC', quantidade: 4, itemId: 'tag-mini' },
  { id: 'ord-3', numPed: '3798-16092026-03', cliente: 'BIOMEDICAL DISTRIBUTION MERC', quantidade: 25, itemId: 'st-8410' },
  { id: 'ord-4', numPed: '3801-17092026-01', cliente: 'DIALOGO LOGISTICA INTELIGENTE', quantidade: 3, itemId: 'st-8410' },
  { id: 'ord-5', numPed: '3802-17092026-AS1', cliente: 'DIALOGO LOGISTICA INTELIGENTE', quantidade: 1, itemId: 'st-8410' },
  { id: 'ord-6', numPed: '3807-17092026-TE3', cliente: 'TRANSPORTES BERTOLINI LTDA', quantidade: 2, itemId: 'tag-mini' },
  { id: 'ord-7', numPed: '3810-17092026-04', cliente: 'DELOG SERVICOS LOGISTICOS LTDA', quantidade: 1, itemId: 'st-8410' },
  { id: 'ord-8', numPed: '3811-17092026-05', cliente: 'VOLPLAN TRANSPORTES LTDA', quantidade: 5, itemId: 'st-8410', entregueProducao: true },
  { id: 'ord-9', numPed: '3812-17092026-06', cliente: 'VOLPLAN TRANSPORTES LTDA', quantidade: 2, itemId: 'st-8410', entregueProducao: true },
  { id: 'ord-10', numPed: '3813-17092026-07', cliente: 'COOPERATIVA DOS TRANSPORTAD', quantidade: 10, itemId: 'st-8410', entregueProducao: true },
  { id: 'ord-11', numPed: '3814-17092026-08', cliente: 'FRISACRE FRIGORIFICO SANTO AFC', quantidade: 1, itemId: 'queck-4g' },
  { id: 'ord-12', numPed: '3815-17092026-UP1', cliente: 'FRISACRE FRIGORIFICO SANTO AFC', quantidade: 18, itemId: 'queck-4g' },
  // Orders corresponding to other lines from the spreadsheet so totals match perfectly:
  { id: 'ord-13', numPed: 'ALVOAR-2G', cliente: 'ALVOAR LACTEOS', quantidade: 170, itemId: '2g-dev', entregueProducao: true },
  { id: 'ord-14', numPed: '3813-17092026-07-2G', cliente: 'COOPERATIVA DOS TRANSPORTAD', quantidade: 10, itemId: '2g-dev', entregueProducao: true },
  { id: 'ord-15', numPed: '3811-17092026-05-2G', cliente: 'VOLPLAN TRANSPORTES LTDA', quantidade: 5, itemId: '2g-dev', entregueProducao: true },
  { id: 'ord-16', numPed: 'ALVOAR-3800', cliente: 'ALVOAR LACTEOS', quantidade: 83, itemId: 'queck-4g-bat-3800', entregueProducao: true },
  { id: 'ord-17', numPed: '3591-14082026-02', cliente: 'PRODUCAO RASTREADORES', quantidade: 66, itemId: 'st-8380', entregueProducao: true },
];

// Sem Pedido entries in bottom-right box: feeds "Comprometidas Sem Pedido"
export const INITIAL_SEM_PEDIDO: SemPedidoEntry[] = [
  { id: 'sp-1', quantidade: 46, itemId: 'tag-card', destino: 'TAG CARD Santa Cruz' },
];

// Equipment delivery tracking cards (Cards de entrega para produção no canto inferior direito)
export const INITIAL_DELIVERIES: EquipmentDeliveryEntry[] = [
  // 2G (DEV)
  { id: 'del-1', cardKey: '2g-dev', quantidade: 170, destinoOuPedido: 'Alvoar' },
  { id: 'del-2', cardKey: '2g-dev', quantidade: 10, destinoOuPedido: '3813-17092026-07' },
  { id: 'del-3', cardKey: '2g-dev', quantidade: 5, destinoOuPedido: '3811-17092026-05' },

  // Queck 3.800
  { id: 'del-4', cardKey: 'queck-4g-bat-3800', quantidade: 83, destinoOuPedido: 'Alvoar' },

  // TAG MINI
  { id: 'del-5', cardKey: 'tag-mini', quantidade: 1, destinoOuPedido: 'Victor cx 3D' },

  // ST-8380
  { id: 'del-6', cardKey: 'st-8380', quantidade: 66, destinoOuPedido: '3591-14082026-02' },
];

export const DELIVERY_CARDS_CONFIG = [
  { key: 'st-8410', title: '8410', itemId: 'st-8410' },
  { key: '2g-dev', title: '2G (DEV)', itemId: '2g-dev' },
  { key: '4g-dev', title: '4G (DEV)', itemId: '4g-dev' },
  { key: 'sem-pedido', title: 'Sem pedido', isSemPedidoSpecial: true },
  { key: 'queck-4g-bat-3800', title: 'Queck 3.800', itemId: 'queck-4g-bat-3800' },
  { key: 'queck-2g', title: 'Queck (2G)', itemId: 'queck-2g' },
  { key: 'queck-4g', title: 'Queck 4G', itemId: 'queck-4g' },
  { key: 'tag-card', title: 'TAG CARD', itemId: 'tag-card' },
  { key: 'tag-mini', title: 'TAG MINI', itemId: 'tag-mini' },
  { key: 'st-8380', title: 'ST-8380', itemId: 'st-8380' },
  { key: 'st-340-ur', title: 'ST-340 UR+SG', itemId: 'st-340-ur' },
  { key: 'st-8395', title: 'ST-8395', itemId: 'st-8395' },
  { key: 'lt-32-pro', title: 'LT-32 PRO', itemId: 'lt-32-pro' },
  { key: 'lt-32', title: 'LT-32', itemId: 'lt-32' },
  { key: 'st-310-u', title: 'ST-310U', itemId: 'st-310-u' },
  { key: 'st-310-uc2', title: 'ST-310 UC2', itemId: 'st-310-uc2' },
  { key: 'st-43', title: 'ST-43', itemId: 'st-43' },
  { key: 'st-8310-um', title: 'ST-8310 UM', itemId: 'st-8310-um' },
  { key: 'com-a-producao', title: 'Com a Produção', itemId: undefined },
];
