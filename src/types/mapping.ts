export type ItemGroup = 'ISCA 2G' | 'ISCA 4G' | 'TAGS' | 'RASTREADORES' | 'INDISPONÍVEL';

export interface MappingLayoutColumn {
  id: string;
  title: string;
  itemIds: string[];
  group?: ItemGroup;
  locked?: boolean;
}

export interface MappingCustomColumn {
  id: string;
  title: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  group: ItemGroup;
  aliases?: string[];
  unit?: string;
  readOnly?: boolean;
}

export interface EquipmentStockValues {
  fisico: number;
  quantidade?: number;
  emManutencao: number;
  compraRealizada: number;
}

export interface ChipReportRow {
  operadora: string;
  saldoFisico: number;
  comPedido: number;
  semPedido: number;
  entregueProducao: number;
}

export interface OrderItem {
  id: string;
  numPed: string;
  cliente: string;
  quantidade: number;
  itemId: string; // references EquipmentItem.id
  entregueProducao?: boolean;
  destinadoProducao?: number; // quantity delivered / destined to production
  dataEnvio?: string;
  modeloDesc?: string;
  tipoNegocio?: string;
  ordemProducaoId?: string;
  observacao?: string;
  dataSolicitacao?: string;
  cnpj?: string;
  comercial?: string;
  contrato?: string;
  tipoEntrega?: string;
  tipoItem?: string;
  operadora?: string;
  geracao?: string;
  modeloVariacao?: string;
  corVariacao?: string;
  carregador?: string;
  quantidadeCarregador?: number | string;
}

export interface SemPedidoEntry {
  id: string;
  quantidade: number;
  itemId: string; // references EquipmentItem.id
  destino: string; // e.g. "TAG CARD Santa Cruz"
  data?: string;
}

export interface EquipmentDeliveryEntry {
  id: string;
  cardKey: string; // e.g. 'st-8410', '2g-dev', 'queck-4g-bat-3800'
  quantidade: number;
  destinoOuPedido: string; // e.g. 'Alvoar', '3813-17092026-07', 'Victor cx 3D'
  data?: string;
  linkedOrderId?: string; // links to OrderItem.id or numPed
  linkedOrderNumber?: string;
}

export interface CalculatedItemRow {
  item: EquipmentItem;
  fisico: number;
  quantidade: number;
  comPedido: number;
  semPedido: number;
  saldoReal: number;
  emManutencao: number;
  compraRealizada: number;
  saldoPosEntrega: number;
}

export interface GroupSummary {
  group: ItemGroup;
  title: string;
  fisico: number;
  comPedido: number;
  semPedido: number;
  saldoReal: number;
  emManutencao: number;
  compraRealizada: number;
  saldoPosEntrega: number;
}

export interface ProductionMappingState {
  stockValues: Record<string, EquipmentStockValues>;
  orders: OrderItem[];
  semPedidoEntries: SemPedidoEntry[];
  deliveries: EquipmentDeliveryEntry[];
}
