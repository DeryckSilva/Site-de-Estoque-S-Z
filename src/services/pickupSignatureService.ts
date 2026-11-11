import { sharedWmsClient } from './sharedWmsStore';
import type { CapturedSignature, PickupSignatureRequest } from '../types/pickupSignature';

const LOCAL_STORAGE_KEY = 'kiraso_pickup_signatures_v1';
const WMS_DATA_KEY = 'pickupSignatures';
export type SignatureRole = 'production' | 'logistics';

function isCapturedSignature(value: unknown): value is CapturedSignature {
  if (!value || typeof value !== 'object') return false;
  const signature = value as Partial<CapturedSignature>;
  return typeof signature.name === 'string' &&
    typeof signature.image === 'string' &&
    signature.image.startsWith('data:image/png;base64,') &&
    typeof signature.signedAt === 'string';
}

function isPickupSignatureRequest(value: unknown): value is PickupSignatureRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<PickupSignatureRequest>;
  return typeof request.id === 'string' &&
    typeof request.orderCode === 'string' &&
    typeof request.salesOrder === 'string' &&
    typeof request.customer === 'string' &&
    typeof request.equipmentQuantity === 'number' &&
    Number.isInteger(request.equipmentQuantity) &&
    request.equipmentQuantity > 0 &&
    typeof request.chipQuantity === 'number' &&
    Number.isInteger(request.chipQuantity) &&
    request.chipQuantity >= 0 &&
    typeof request.batteryType === 'string' &&
    typeof request.pickupDate === 'string' &&
    typeof request.createdAt === 'string' &&
    (request.campaignCode === undefined || typeof request.campaignCode === 'string') &&
    (request.separationDate === undefined || typeof request.separationDate === 'string') &&
    (request.observations === undefined || typeof request.observations === 'string') &&
    (request.productionSignature === undefined || isCapturedSignature(request.productionSignature)) &&
    (request.logisticsSignature === undefined || isCapturedSignature(request.logisticsSignature));
}

function normalizeRequest(value: unknown): PickupSignatureRequest | null {
  if (!isPickupSignatureRequest(value)) return null;
  return {
    ...value,
    campaignCode: value.campaignCode || value.salesOrder,
    separationDate: value.separationDate || value.pickupDate,
    observations: value.observations || '',
  };
}

function mergeRequest(
  previous: PickupSignatureRequest | undefined,
  request: PickupSignatureRequest,
  signatureUpdate?: { role: SignatureRole; value: CapturedSignature },
): PickupSignatureRequest {
  const merged: PickupSignatureRequest = {
    ...previous,
    ...request,
    productionSignature: previous?.productionSignature ?? request.productionSignature,
    logisticsSignature: previous?.logisticsSignature ?? request.logisticsSignature,
  };
  if (signatureUpdate?.role === 'production') merged.productionSignature = signatureUpdate.value;
  if (signatureUpdate?.role === 'logistics') merged.logisticsSignature = signatureUpdate.value;
  return merged;
}

function readLocalRequests(): PickupSignatureRequest[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Os registros locais de retirada possuem um formato inválido.');
  }
  return parsed.map(normalizeRequest).filter((request): request is PickupSignatureRequest => request !== null);
}

function readSharedRequests(data: unknown): PickupSignatureRequest[] {
  if (!data || typeof data !== 'object') return [];
  const requests = (data as Record<string, unknown>)[WMS_DATA_KEY];
  if (requests == null) return [];
  if (!Array.isArray(requests)) {
    throw new Error('Os registros compartilhados de retirada possuem um formato inválido.');
  }
  return requests.map(normalizeRequest).filter((request): request is PickupSignatureRequest => request !== null);
}

export async function loadPickupSignatures(): Promise<PickupSignatureRequest[]> {
  if (!sharedWmsClient) return readLocalRequests();

  const { data, error } = await sharedWmsClient
    .from('warehouse_state')
    .select('data')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data ? readSharedRequests(data.data) : [];
}

export async function savePickupSignature(
  request: PickupSignatureRequest,
  signatureUpdate?: { role: SignatureRole; value: CapturedSignature },
): Promise<void> {
  if (!isPickupSignatureRequest(request)) {
    throw new Error('Os dados da retirada estão incompletos ou inválidos.');
  }

  if (!sharedWmsClient) {
    const requests = readLocalRequests();
    const previous = requests.find((item) => item.id === request.id);
    const nextRequest = mergeRequest(previous, request, signatureUpdate);
    const next = [nextRequest, ...requests.filter((item) => item.id !== request.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('kiraso_pickup_signatures_sync'));
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: current, error: loadError } = await sharedWmsClient
      .from('warehouse_state')
      .select('data, revision')
      .eq('id', 1)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!current) {
      throw new Error('O WMS compartilhado ainda não foi inicializado. Abra a aba WMS e tente novamente.');
    }

    const currentData = current.data && typeof current.data === 'object'
      ? current.data as Record<string, unknown>
      : {};
    const requests = readSharedRequests(currentData);
    const previous = requests.find((item) => item.id === request.id);
    const nextRequest = mergeRequest(previous, request, signatureUpdate);
    const nextRequests = [nextRequest, ...requests.filter((item) => item.id !== request.id)];
    const nextData = { ...currentData, [WMS_DATA_KEY]: nextRequests };
    const { data: saved, error: saveError } = await sharedWmsClient
      .from('warehouse_state')
      .update({
        data: nextData,
        revision: current.revision + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .eq('revision', current.revision)
      .select('revision')
      .maybeSingle();
    if (saveError) throw saveError;
    if (saved) return;
  }

  throw new Error('Outra pessoa atualizou o WMS ao mesmo tempo. Recarregue a página e tente novamente.');
}

export function watchPickupSignatures(onChange: () => void, onError: (error: unknown) => void): () => void {
  const client = sharedWmsClient;
  if (!client) {
    const refresh = () => onChange();
    window.addEventListener('storage', refresh);
    window.addEventListener('kiraso_pickup_signatures_sync', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('kiraso_pickup_signatures_sync', refresh);
    };
  }

  const channel = client
    .channel('pickup-signatures-live')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'warehouse_state',
      filter: 'id=eq.1',
    }, () => onChange())
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(new Error('A atualização em tempo real das assinaturas está indisponível.'));
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
