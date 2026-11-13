import { sharedWmsClient } from './sharedWmsStore';
import type {
  CompletedProductionSeparation,
  NewProductionEquipmentSwap,
  ProductionEquipmentSwap,
  ProductionSeparationRecord,
  SeparationOrderDetails,
  SeparatedEquipment,
  SharedProductionSeparation,
} from '../types/productionSeparation';

const TABLE = 'production_separations';
const HISTORY_TABLE = 'production_separation_history';
const SWAPS_TABLE = 'production_equipment_swaps';
const PAGE_SIZE = 1000;

function isQuantity(value: unknown): value is number | string {
  return typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isSeparatedEquipment(value: unknown): value is SeparatedEquipment {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<SeparatedEquipment>;
  return typeof line.id === 'string' &&
    typeof line.equipmentType === 'string' &&
    typeof line.serialNumber === 'string' &&
    typeof line.ccid === 'string' &&
    typeof line.terminalColor === 'string' &&
    typeof line.terminalSize === 'string' &&
    typeof line.terminalDiameter === 'string' &&
    isQuantity(line.terminalQuantity) &&
    typeof line.batteryType === 'string' &&
    typeof line.kraftBoxType === 'string' &&
    isQuantity(line.kraftQuantity) &&
    typeof line.box3dType === 'string' &&
    isQuantity(line.box3dQuantity) &&
    typeof line.magnetType === 'string' &&
    isQuantity(line.magnetQuantity) &&
    typeof line.productionDeliveryDate === 'string' &&
    typeof line.productionResponsible === 'string';
}

function isSeparationRecord(value: unknown): value is ProductionSeparationRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ProductionSeparationRecord>;
  const details = record.orderDetails as Partial<SeparationOrderDetails> | undefined;
  return typeof record.id === 'string' &&
    typeof record.orderNumber === 'string' &&
    typeof record.clientName === 'string' &&
    (details === undefined || (
      typeof details === 'object' &&
      details !== null &&
      typeof details.requestedQuantity === 'number' &&
      Number.isFinite(details.requestedQuantity) &&
      details.requestedQuantity >= 0 &&
      typeof details.productType === 'string' &&
      typeof details.operator === 'string' &&
      typeof details.equipmentModel === 'string' &&
      typeof details.modelVariation === 'string' &&
      typeof details.colorVariation === 'string' &&
      typeof details.businessType === 'string' &&
      typeof details.deliveryType === 'string' &&
      typeof details.requestDate === 'string' &&
      typeof details.expectedDeliveryDate === 'string'
    )) &&
    typeof record.separatedBy === 'string' &&
    typeof record.deliveryResponsible === 'string' &&
    typeof record.separationDate === 'string' &&
    Array.isArray(record.equipment) &&
    record.equipment.every(isSeparatedEquipment);
}

function parseSharedRecord(value: unknown): SharedProductionSeparation {
  if (!value || typeof value !== 'object') {
    throw new Error('O banco retornou um registro de separação inválido.');
  }
  const row = value as {
    id?: unknown;
    revision?: unknown;
    data?: unknown;
    updated_at?: unknown;
  };
  const revision = Number(row.revision);
  if (
    typeof row.id !== 'string' ||
    !Number.isInteger(revision) ||
    revision < 0 ||
    !isSeparationRecord(row.data) ||
    row.data.id !== row.id ||
    typeof row.updated_at !== 'string'
  ) {
    throw new Error('O banco retornou um registro de separação inválido.');
  }
  return { ...row.data, revision, updatedAt: row.updated_at };
}

function parseHistoryRecord(value: unknown): CompletedProductionSeparation {
  if (!value || typeof value !== 'object') {
    throw new Error('O banco retornou um item inválido no histórico de separações.');
  }
  const row = value as {
    id?: unknown;
    order_number?: unknown;
    client_name?: unknown;
    finalized_at?: unknown;
    data?: unknown;
  };
  if (
    typeof row.id !== 'string' ||
    typeof row.order_number !== 'string' ||
    typeof row.client_name !== 'string' ||
    typeof row.finalized_at !== 'string' ||
    !isSeparationRecord(row.data) ||
    row.data.orderNumber !== row.order_number
  ) {
    throw new Error('O banco retornou um item inválido no histórico de separações.');
  }
  return {
    id: row.id,
    orderNumber: row.order_number,
    clientName: row.client_name,
    finalizedAt: row.finalized_at,
    data: row.data,
  };
}

function parseEquipmentSwap(value: unknown): ProductionEquipmentSwap {
  if (!value || typeof value !== 'object') {
    throw new Error('O banco retornou um registro de troca inválido.');
  }
  const row = value as {
    id?: unknown;
    order_number?: unknown;
    client_name?: unknown;
    equipment_type?: unknown;
    component?: unknown;
    previous_value?: unknown;
    new_value?: unknown;
    responsible?: unknown;
    swapped_on?: unknown;
  };
  if (
    typeof row.id !== 'string' ||
    typeof row.order_number !== 'string' ||
    typeof row.client_name !== 'string' ||
    typeof row.equipment_type !== 'string' ||
    (row.component !== 'serial' && row.component !== 'ccid') ||
    typeof row.previous_value !== 'string' ||
    typeof row.new_value !== 'string' ||
    typeof row.responsible !== 'string' ||
    typeof row.swapped_on !== 'string'
  ) {
    throw new Error('O banco retornou um registro de troca inválido.');
  }
  return {
    id: row.id,
    orderNumber: row.order_number,
    clientName: row.client_name,
    equipmentType: row.equipment_type,
    component: row.component,
    previousValue: row.previous_value,
    newValue: row.new_value,
    responsible: row.responsible,
    swappedOn: row.swapped_on,
  };
}

function getClient() {
  if (!sharedWmsClient) {
    throw new Error('O Supabase compartilhado não está configurado neste site.');
  }
  return sharedWmsClient;
}

export async function listProductionSeparations(): Promise<SharedProductionSeparation[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select('id, revision, data, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('O banco retornou uma lista de separações inválida.');
  return data.map(parseSharedRecord);
}

export async function listCompletedProductionSeparations(): Promise<CompletedProductionSeparation[]> {
  const records: CompletedProductionSeparation[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await getClient()
      .from(HISTORY_TABLE)
      .select('id, order_number, client_name, finalized_at, data')
      .order('finalized_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('O banco retornou uma lista de histórico inválida.');
    records.push(...data.map(parseHistoryRecord));
    if (data.length < PAGE_SIZE) return records;
  }
}

export async function listProductionEquipmentSwaps(): Promise<ProductionEquipmentSwap[]> {
  const swaps: ProductionEquipmentSwap[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await getClient()
      .from(SWAPS_TABLE)
      .select('id, order_number, client_name, equipment_type, component, previous_value, new_value, responsible, swapped_on')
      .order('swapped_on', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('O banco retornou uma lista de trocas inválida.');
    swaps.push(...data.map(parseEquipmentSwap));
    if (data.length < PAGE_SIZE) return swaps;
  }
}

export async function finalizeProductionSeparation(
  record: SharedProductionSeparation,
): Promise<string> {
  const { data, error } = await getClient().rpc('finalize_production_separation', {
    p_id: record.id,
    p_revision: record.revision,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('O banco não confirmou o arquivamento da separação.');
  return data;
}

export async function createProductionEquipmentSwap(
  swap: NewProductionEquipmentSwap,
): Promise<ProductionEquipmentSwap> {
  const orderNumber = swap.orderNumber.trim();
  const previousValue = swap.previousValue.trim();
  const newValue = swap.newValue.trim();
  if (!orderNumber || !previousValue || !newValue) {
    throw new Error('Preencha o pedido, o valor antigo e o novo valor.');
  }
  if (previousValue === newValue) {
    throw new Error('O valor novo precisa ser diferente do valor antigo.');
  }

  const { data, error } = await getClient()
    .from(SWAPS_TABLE)
    .insert({
      order_number: orderNumber,
      client_name: swap.clientName.trim(),
      equipment_type: swap.equipmentType.trim(),
      component: swap.component,
      previous_value: previousValue,
      new_value: newValue,
      responsible: swap.responsible.trim(),
      swapped_on: swap.swappedOn,
    })
    .select('id, order_number, client_name, equipment_type, component, previous_value, new_value, responsible, swapped_on')
    .single();
  if (error) throw error;
  return parseEquipmentSwap(data);
}

export async function createProductionSeparation(
  record: ProductionSeparationRecord
): Promise<SharedProductionSeparation> {
  const { data, error } = await getClient()
    .from(TABLE)
    .insert({ id: record.id, revision: 0, data: record })
    .select('id, revision, data, updated_at')
    .single();
  if (error) throw error;
  return parseSharedRecord(data);
}

export async function saveProductionSeparation(
  record: SharedProductionSeparation
): Promise<SharedProductionSeparation> {
  const { revision, updatedAt: _updatedAt, ...data } = record;
  const { data: saved, error } = await getClient()
    .from(TABLE)
    .update({ revision: revision + 1, data })
    .eq('id', record.id)
    .eq('revision', revision)
    .select('id, revision, data, updated_at')
    .maybeSingle();
  if (error) throw error;
  if (!saved) {
    throw new Error('Este pedido foi alterado em outro computador. Atualize a página antes de salvar novamente.');
  }
  return parseSharedRecord(saved);
}

export function parseRealtimeProductionSeparation(value: unknown): SharedProductionSeparation {
  return parseSharedRecord(value);
}
