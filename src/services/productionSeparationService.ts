import { sharedWmsClient } from './sharedWmsStore';
import type {
  ProductionSeparationRecord,
  SeparatedEquipment,
  SharedProductionSeparation,
} from '../types/productionSeparation';

const TABLE = 'production_separations';

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
    typeof line.terminalQuantity === 'number' &&
    typeof line.batteryType === 'string' &&
    typeof line.kraftBoxType === 'string' &&
    typeof line.kraftQuantity === 'number' &&
    typeof line.box3dType === 'string' &&
    typeof line.box3dQuantity === 'number' &&
    typeof line.magnetType === 'string' &&
    typeof line.magnetQuantity === 'number' &&
    typeof line.productionDeliveryDate === 'string' &&
    typeof line.productionResponsible === 'string';
}

function isSeparationRecord(value: unknown): value is ProductionSeparationRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ProductionSeparationRecord>;
  return typeof record.id === 'string' &&
    typeof record.orderNumber === 'string' &&
    typeof record.clientName === 'string' &&
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

export async function deleteProductionSeparation(
  record: SharedProductionSeparation
): Promise<void> {
  const { data, error } = await getClient()
    .from(TABLE)
    .delete()
    .eq('id', record.id)
    .eq('revision', record.revision)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('Este pedido foi alterado em outro computador. Atualize a página antes de excluí-lo.');
  }
}

export function parseRealtimeProductionSeparation(value: unknown): SharedProductionSeparation {
  return parseSharedRecord(value);
}
