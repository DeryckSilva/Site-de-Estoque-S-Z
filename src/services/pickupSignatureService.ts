import { sharedPickupClient } from './pickupSignatureStore';
import type { CapturedSignature, PickupSignatureRequest } from '../types/pickupSignature';

const LOCAL_STORAGE_KEY = 'kiraso_pickup_signatures_v1';
const SHARED_REQUEST_IDS_KEY = 'kiraso_pickup_signature_ids_v1';
const DELETE_TOKENS_KEY = 'kiraso_pickup_signature_delete_tokens_v1';
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SharedRequestRecord {
  request: PickupSignatureRequest;
  revision: number;
}

export interface PickupSignatureListEntry {
  request: PickupSignatureRequest;
  canDelete: boolean;
}

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
    REQUEST_ID_PATTERN.test(request.id) &&
  (request.recordType === undefined ||
    request.recordType === 'order' ||
    request.recordType === 'test' ||
    request.recordType === 'adHoc') &&
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
    (request.productionSignature === undefined || isCapturedSignature(request.productionSignature));
}

function normalizeRequest(value: unknown): PickupSignatureRequest | null {
  if (!isPickupSignatureRequest(value)) return null;
  return {
    ...value,
    recordType: value.recordType || 'order',
    campaignCode: value.campaignCode || value.salesOrder,
    separationDate: value.separationDate || value.pickupDate,
    observations: value.observations || '',
  };
}

function mergeRequest(
  previous: PickupSignatureRequest | undefined,
  request: PickupSignatureRequest,
  signatureUpdate?: CapturedSignature,
): PickupSignatureRequest {
  const merged: PickupSignatureRequest = {
    ...previous,
    ...request,
    productionSignature: previous?.productionSignature ?? request.productionSignature,
  };
  if (signatureUpdate) merged.productionSignature = signatureUpdate;
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

function readSharedRequestIds(): string[] {
  const raw = localStorage.getItem(SHARED_REQUEST_IDS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string' && REQUEST_ID_PATTERN.test(id))) {
    throw new Error('O histórico local de retiradas possui um formato inválido.');
  }
  return [...new Set(parsed)];
}

function rememberSharedRequestId(id: string): void {
  const ids = readSharedRequestIds();
  if (!ids.includes(id)) {
    localStorage.setItem(SHARED_REQUEST_IDS_KEY, JSON.stringify([...ids, id]));
  }
}

function readDeleteTokens(): Record<string, string> {
  const raw = localStorage.getItem(DELETE_TOKENS_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('As permissões locais para apagar retiradas possuem um formato inválido.');
  }
  const entries = Object.entries(parsed);
  if (!entries.every(([id, token]) => REQUEST_ID_PATTERN.test(id) && typeof token === 'string' && REQUEST_ID_PATTERN.test(token))) {
    throw new Error('Uma permissão local para apagar retirada possui um formato inválido.');
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function rememberDeleteToken(id: string, token: string): void {
  const tokens = readDeleteTokens();
  tokens[id] = token;
  localStorage.setItem(DELETE_TOKENS_KEY, JSON.stringify(tokens));
}

function forgetDeleteToken(id: string): void {
  const tokens = readDeleteTokens();
  delete tokens[id];
  localStorage.setItem(DELETE_TOKENS_KEY, JSON.stringify(tokens));
}

function forgetSharedRequestId(id: string): void {
  const ids = readSharedRequestIds().filter((requestId) => requestId !== id);
  localStorage.setItem(SHARED_REQUEST_IDS_KEY, JSON.stringify(ids));
}

function decodeSharedRequestRecords(value: unknown): SharedRequestRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Os registros compartilhados de retirada possuem um formato inválido.');
  }

  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Um registro compartilhado de retirada possui um formato inválido.');
    }
    const record = item as Record<string, unknown>;
    const request = normalizeRequest(record.data);
    const revision = typeof record.revision === 'number'
      ? record.revision
      : typeof record.revision === 'string' && /^\d+$/.test(record.revision)
        ? Number(record.revision)
        : Number.NaN;
    if (!request || !Number.isSafeInteger(revision) || revision < 0) {
      throw new Error('Um registro compartilhado de retirada possui um formato inválido.');
    }
    return { request, revision };
  });
}

async function loadSharedRequestRecords(ids: string[]): Promise<SharedRequestRecord[]> {
  if (!sharedPickupClient || ids.length === 0) return [];

  const { data, error } = await sharedPickupClient.rpc('get_pickup_signature_requests', {
    p_request_ids: ids,
  });
  if (error) throw error;
  return decodeSharedRequestRecords(data);
}

export async function loadPickupSignatureList(): Promise<PickupSignatureListEntry[]> {
  if (!sharedPickupClient) {
    return readLocalRequests().map((request) => ({ request, canDelete: true }));
  }

  const { data, error } = await sharedPickupClient.rpc('list_pickup_signature_requests');
  if (error) throw error;

  return decodeSharedRequestRecords(data)
    .sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt))
    .map(({ request }) => ({
      request,
      canDelete: true,
    }));
}

export async function loadPickupSignatures(requestId?: string): Promise<PickupSignatureRequest[]> {
  if (!sharedPickupClient) {
    const localRequests = readLocalRequests();
    return requestId ? localRequests.filter((request) => request.id === requestId) : localRequests;
  }

  if (requestId && !REQUEST_ID_PATTERN.test(requestId)) {
    throw new Error('O identificador deste QR Code é inválido.');
  }
  if (requestId) {
    const records = await loadSharedRequestRecords([requestId]);
    return records.map(({ request }) => request);
  }

  return (await loadPickupSignatureList()).map(({ request }) => request);
}

export async function savePickupSignature(
  request: PickupSignatureRequest,
  signatureUpdate?: CapturedSignature,
): Promise<void> {
  if (!isPickupSignatureRequest(request)) {
    throw new Error('Os dados da retirada estão incompletos ou inválidos.');
  }

  if (!sharedPickupClient) {
    const requests = readLocalRequests();
    const previous = requests.find((item) => item.id === request.id);
    if (signatureUpdate && (previous?.productionSignature || request.productionSignature)) {
      throw new Error('Esta retirada já foi assinada pela Produção e está disponível somente para consulta.');
    }
    if (!signatureUpdate && !previous) {
      rememberDeleteToken(request.id, crypto.randomUUID());
    }
    const nextRequest = mergeRequest(previous, request, signatureUpdate);
    const next = [nextRequest, ...requests.filter((item) => item.id !== request.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('kiraso_pickup_signatures_sync'));
    return;
  }

  if (!signatureUpdate) {
    const deleteToken = crypto.randomUUID();
    rememberDeleteToken(request.id, deleteToken);
    rememberSharedRequestId(request.id);
    const { data, error } = await sharedPickupClient.rpc('create_pickup_signature_request', {
      p_request_id: request.id,
      p_request_data: request,
      p_delete_token: deleteToken,
    });
    if (error) {
      forgetDeleteToken(request.id);
      throw error;
    }
    if (data !== true) {
      forgetDeleteToken(request.id);
      throw new Error('Não foi possível criar esta retirada. Gere um novo QR Code e tente novamente.');
    }
    window.dispatchEvent(new Event('kiraso_pickup_signatures_sync'));
    return;
  }

  if (!isCapturedSignature(signatureUpdate)) {
    throw new Error('Os dados da assinatura estão incompletos ou inválidos.');
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [current] = await loadSharedRequestRecords([request.id]);
    if (!current) {
      throw new Error('Retirada não encontrada no compartilhamento. Peça à Produção para gerar um novo QR Code.');
    }
    if (current.request.productionSignature) {
      throw new Error('Esta retirada já foi assinada pela Produção e está disponível somente para consulta.');
    }

    const { data: saved, error: saveError } = await sharedPickupClient.rpc('save_pickup_signature_request', {
      p_request_id: request.id,
      p_expected_revision: current.revision,
      p_role: 'production',
      p_signature: signatureUpdate,
    });
    if (saveError) throw saveError;
    if (typeof saved === 'number' && Number.isSafeInteger(saved)) {
      window.dispatchEvent(new Event('kiraso_pickup_signatures_sync'));
      return;
    }
    if (saved !== null) {
      throw new Error('O Supabase retornou uma resposta inválida ao salvar a assinatura.');
    }
  }

  throw new Error('Outra pessoa atualizou o WMS ao mesmo tempo. Recarregue a página e tente novamente.');
}

export async function deletePickupSignature(id: string): Promise<void> {
  if (!REQUEST_ID_PATTERN.test(id)) {
    throw new Error('O identificador desta retirada é inválido.');
  }
  if (sharedPickupClient) {
    const { data, error } = await sharedPickupClient.rpc('delete_pickup_signature_request', {
      p_request_id: id,
      p_delete_token: null,
    });
    if (error) throw error;
    if (data !== true) {
      throw new Error('Não foi possível apagar. O registro pode já ter sido removido.');
    }
    forgetSharedRequestId(id);
  } else {
    const requests = readLocalRequests();
    const next = requests.filter((request) => request.id !== id);
    if (next.length === requests.length) {
      throw new Error('Retirada não encontrada neste navegador.');
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  }

  forgetDeleteToken(id);
  window.dispatchEvent(new Event('kiraso_pickup_signatures_sync'));
}

export function watchPickupSignatures(onChange: () => void): () => void {
  const refresh = () => onChange();
  window.addEventListener('storage', refresh);
  window.addEventListener('kiraso_pickup_signatures_sync', refresh);
  window.addEventListener('focus', refresh);
  const interval = sharedPickupClient
    ? window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 15_000)
    : undefined;
  return () => {
    window.removeEventListener('storage', refresh);
    window.removeEventListener('kiraso_pickup_signatures_sync', refresh);
    window.removeEventListener('focus', refresh);
    if (interval !== undefined) window.clearInterval(interval);
  };
}
