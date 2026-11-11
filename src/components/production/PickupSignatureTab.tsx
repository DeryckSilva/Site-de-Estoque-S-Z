import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, CheckCircle2, ClipboardList, ExternalLink, Plus, QrCode, RefreshCw } from 'lucide-react';
import type { ProductionOrder } from '../../types/production';
import type { PickupSignatureRequest } from '../../types/pickupSignature';
import type { BaseOrder } from '../../types/orders';
import type { EquipmentDeliveryEntry, OrderItem } from '../../types/mapping';
import { loadPickupSignatures, savePickupSignature, watchPickupSignatures } from '../../services/pickupSignatureService';
import { readPanelProductionOrders } from '../../services/productionOrdersService';
import { STORAGE_KEYS } from '../../services/productionSyncService';
import { loadAttendedOrderNumbers, loadOrdersFromGoogleSheet } from '../../services/googleSheetOrders';
import { EQUIPMENT_ITEMS } from '../../data/initialData';
import { sharedPickupClient } from '../../services/pickupSignatureStore';

function readMappingOrders(): OrderItem[] {
  const saved = localStorage.getItem(STORAGE_KEYS.MAPPING_ORDERS);
  if (!saved) return [];

  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) {
    throw new Error('A lista de pedidos do Mapeamento possui um formato inválido.');
  }
  return parsed as OrderItem[];
}

function toMappingOrder(source: BaseOrder, existing?: OrderItem): OrderItem {
  return {
    ...existing,
    id: existing?.id || `sheet-${source.id}`,
    numPed: source.numPedido,
    cliente: source.cliente,
    quantidade: source.quantidade,
    itemId: source.mappedItemId,
    dataEnvio: source.dataEnvio,
    dataSolicitacao: source.dataSolicitacao,
    cnpj: source.cnpj,
    comercial: source.comercial,
    contrato: source.contrato,
    tipoEntrega: source.tipoEntrega,
    tipoItem: source.tipoItem,
    operadora: source.operadora,
    geracao: source.geracao,
    modeloVariacao: source.modeloVariacao,
    corVariacao: source.corVariacao,
    carregador: source.carregador,
    quantidadeCarregador: source.quantidadeCarregador,
    modeloDesc: `${source.geracao || ''} ${source.modeloVariacao || ''}`.trim(),
    tipoNegocio: source.tipoNegocio,
    observacao: source.observacao,
  };
}

function today(): string {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function getSignatureUrl(id: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('view', 'assinatura');
  url.searchParams.set('id', id);
  return url.toString();
}

function formatSignatureDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString('pt-BR');
}

export function PickupSignatureTab() {
  const [orders, setOrders] = useState<ProductionOrder[]>(readPanelProductionOrders);
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? '');
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const [customer, setCustomer] = useState(selectedOrder?.clienteSolicitante ?? '');
  const [equipmentQuantity, setEquipmentQuantity] = useState(String(selectedOrder?.totalQtd ?? 1));
  const [chipQuantity, setChipQuantity] = useState('0');
  const [batteryType, setBatteryType] = useState('');
  const [separationDate, setSeparationDate] = useState(today);
  const [pickupDate, setPickupDate] = useState(today);
  const [observations, setObservations] = useState(selectedOrder?.observacoes ?? '');
  const [requests, setRequests] = useState<PickupSignatureRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [error, setError] = useState('');

  const refreshRequests = async () => {
    try {
      setRequests(await loadPickupSignatures());
      setError('');
    } catch (loadError) {
      console.error('Falha ao carregar solicitações de assinatura:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as solicitações de assinatura.');
    } finally {
      setLoading(false);
    }
  };

  const refreshOrders = async () => {
    setIsRefreshingOrders(true);
    setError('');
    try {
      const [sheetOrders, attendedNumbers] = await Promise.all([
        loadOrdersFromGoogleSheet(),
        loadAttendedOrderNumbers(),
      ]);
      const currentMappingOrders = readMappingOrders();
      const currentByNumber = new Map(
        currentMappingOrders.map((order) => [order.numPed.trim().toLowerCase(), order])
      );
      const refreshedOrders = sheetOrders
        .filter((source) => !attendedNumbers.has(source.numPedido.trim().toLowerCase()))
        .map((source) =>
          toMappingOrder(source, currentByNumber.get(source.numPedido.trim().toLowerCase()))
        );
      const refreshedNumbers = new Set(
        refreshedOrders.map((order) => order.numPed.trim().toLowerCase())
      );
      const manualOrders = currentMappingOrders.filter((order) =>
        order.id.startsWith('ord-') && !refreshedNumbers.has(order.numPed.trim().toLowerCase())
      );
      const nextMappingOrders = [...refreshedOrders, ...manualOrders];
      const previousOrders = readPanelProductionOrders();
      const previousByNumber = new Map(
        previousOrders.map((order) => [order.pedido.toLowerCase(), order])
      );
      const rawDeliveries = localStorage.getItem(STORAGE_KEYS.MAPPING_DELIVERIES);
      const deliveries = rawDeliveries
        ? JSON.parse(rawDeliveries) as EquipmentDeliveryEntry[]
        : [];
      const updatedOrders = nextMappingOrders.map((mappedOrder): ProductionOrder => {
        const previousOrder = previousByNumber.get(mappedOrder.numPed.toLowerCase());
        const delivered = deliveries
          .filter((delivery) =>
            delivery.linkedOrderId === mappedOrder.id ||
            delivery.linkedOrderNumber?.toLowerCase() === mappedOrder.numPed.toLowerCase() ||
            (delivery.destinoOuPedido || '').toLowerCase().includes(mappedOrder.numPed.toLowerCase())
          )
          .reduce((sum, delivery) => sum + (Number(delivery.quantidade) || 0), 0);
        const total = Number(mappedOrder.quantidade) || 0;
        const destined = delivered || mappedOrder.destinadoProducao || 0;

        return {
          id: previousOrder?.id || `op-${mappedOrder.id}`,
          prioridade: previousOrder?.prioridade || 'Padrão',
          ordem: previousOrder?.ordem || `OP-${mappedOrder.numPed}`,
          origem: previousOrder?.origem || 'Pedido de Venda',
          tipoOrigemBadge: previousOrder?.tipoOrigemBadge || mappedOrder.tipoNegocio || 'Pedido',
          clienteSolicitante: mappedOrder.cliente,
          pedido: mappedOrder.numPed,
          itemModel: mappedOrder.modeloDesc ||
            EQUIPMENT_ITEMS.find((item) => item.id === mappedOrder.itemId)?.name ||
            mappedOrder.itemId,
          produzido: Math.min(previousOrder?.produzido || 0, total),
          falta: Math.max(0, total - (previousOrder?.produzido || 0)),
          totalQtd: total,
          destinado: Math.min(total, destined),
          dataCriacao: previousOrder?.dataCriacao || mappedOrder.dataEnvio || '',
          status: 'A atender',
          bancada: previousOrder?.bancada || 'Bancada 01',
          observacoes: mappedOrder.observacao || previousOrder?.observacoes,
        };
      });

      localStorage.setItem(STORAGE_KEYS.MAPPING_ORDERS, JSON.stringify(nextMappingOrders));
      localStorage.setItem(STORAGE_KEYS.PENDING_OPS, JSON.stringify(updatedOrders));
      setOrders(updatedOrders);
      window.dispatchEvent(new CustomEvent('kiraso_mapping_sync'));
      window.dispatchEvent(new CustomEvent('kiraso_mapping_state_sync'));
      window.dispatchEvent(new CustomEvent('kiraso_orders_sync', { detail: { updatedOps: updatedOrders } }));
    } catch (refreshError) {
      console.error('Falha ao atualizar pedidos para a assinatura da retirada:', refreshError);
      setError('Não foi possível atualizar os pedidos. Verifique o acesso às planilhas.');
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  useEffect(() => {
    void refreshRequests();
    const refreshOrders = () => setOrders(readPanelProductionOrders());
    window.addEventListener('storage', refreshOrders);
    window.addEventListener('kiraso_orders_sync', refreshOrders);
    window.addEventListener('kiraso_mapping_state_sync', refreshOrders);
    const stopWatching = watchPickupSignatures(() => void refreshRequests());
    return () => {
      window.removeEventListener('storage', refreshOrders);
      window.removeEventListener('kiraso_orders_sync', refreshOrders);
      window.removeEventListener('kiraso_mapping_state_sync', refreshOrders);
      stopWatching();
    };
  }, []);

  useEffect(() => {
    setCustomer(selectedOrder?.clienteSolicitante ?? '');
    setEquipmentQuantity(String(selectedOrder?.totalQtd ?? 1));
    setObservations(selectedOrder?.observacoes ?? '');
  }, [selectedOrderId, selectedOrder?.observacoes, selectedOrder?.clienteSolicitante, selectedOrder?.totalQtd]);

  useEffect(() => {
    if (!orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(orders[0]?.id ?? '');
    }
  }, [orders, selectedOrderId]);

  const selectedRequest = requests.find((request) => request.id === selectedRequestId);
  const signaturePageUrl = selectedRequest && sharedPickupClient ? getSignatureUrl(selectedRequest.id) : '';

  const createRequest = async () => {
    if (!sharedPickupClient) {
      setError('O compartilhamento Supabase não está configurado neste site. Configure-o e publique novamente antes de gerar um QR para celular.');
      return;
    }

    const equipmentCount = Number(equipmentQuantity);
    const chipCount = Number(chipQuantity);
    if (!selectedOrder || !customer.trim() || !Number.isInteger(equipmentCount) || equipmentCount <= 0 ||
      !Number.isInteger(chipCount) || chipCount < 0 || !separationDate || !pickupDate) {
      setError('Confira o pedido, cliente, quantidades e as duas datas antes de gerar o QR Code.');
      return;
    }

    const requestId = crypto.randomUUID();
    const request: PickupSignatureRequest = {
      id: requestId,
      orderCode: selectedOrder.ordem,
      salesOrder: selectedOrder.pedido,
      campaignCode: `${selectedOrder.pedido}-${separationDate.replaceAll('-', '')}-${requestId.slice(0, 8).toUpperCase()}`,
      customer: customer.trim(),
      equipmentQuantity: equipmentCount,
      chipQuantity: chipCount,
      batteryType: batteryType.trim(),
      separationDate,
      pickupDate,
      observations: observations.trim(),
      createdAt: new Date().toISOString(),
    };

    setSaving(true);
    setError('');
    try {
      await savePickupSignature(request);
      await refreshRequests();
      setSelectedRequestId(request.id);
    } catch (saveError) {
      console.error('Falha ao gerar QR Code para assinatura:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível gerar o QR Code.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Assinatura da retirada</h1>
            <p className="text-xs text-gray-500">Gere o QR Code para registrar o recebimento pela Produção. Após assinado, fica somente para consulta.</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-800">
          Comprovante digital
        </span>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!sharedPickupClient && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>O Supabase do QR não está configurado neste site. As campanhas ficam neste navegador e não abrem pelo QR em outros dispositivos. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no GitHub e publique novamente.</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-900">Dados do pedido e retirada</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="pickup-order" className="text-xs font-medium text-slate-700">
                  Pedido do Painel de Pedidos
                </label>
                <button
                  type="button"
                  onClick={() => void refreshOrders()}
                  disabled={isRefreshingOrders}
                  className="inline-flex items-center gap-1 rounded bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingOrders ? 'animate-spin' : ''}`} />
                  {isRefreshingOrders ? 'Atualizando...' : 'Atualizar pedidos'}
                </button>
              </div>
              <select
                id="pickup-order"
                value={selectedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>{order.pedido} - {order.clienteSolicitante}</option>
                ))}
              </select>
            </div>
            <label className="space-y-1.5 text-xs font-medium text-slate-700 sm:col-span-2">
              Nome do cliente
              <input value={customer} onChange={(event) => setCustomer(event.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              Quantidade de equipamentos
              <input type="number" min="1" step="1" value={equipmentQuantity} onChange={(event) => setEquipmentQuantity(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              Quantidade de chips
              <input type="number" min="0" step="1" value={chipQuantity} onChange={(event) => setChipQuantity(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              Tipo de bateria
              <input value={batteryType} onChange={(event) => setBatteryType(event.target.value)} placeholder="Ex.: 1.800 mAh"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              Data de separação
              <input type="date" value={separationDate} onChange={(event) => setSeparationDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              Data da retirada
              <input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-700 sm:col-span-2">
              Observações
              <textarea value={observations} onChange={(event) => setObservations(event.target.value)} rows={3}
                placeholder="Observações sobre a campanha ou a retirada"
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
          </div>
          <button type="button" onClick={() => void createRequest()} disabled={saving || !selectedOrder || !sharedPickupClient}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" /> {saving ? 'Gerando...' : sharedPickupClient ? 'Gerar QR Code da retirada' : 'Configure o Supabase para gerar QR'}
          </button>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">QR Code de consulta</h2>
            {selectedRequest && sharedPickupClient && (
              <a href={signaturePageUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900">
                Abrir página <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {selectedRequest && sharedPickupClient ? (
            <div id="pickup-signature-qr-print" className="flex flex-col items-center rounded-lg border border-gray-100 bg-white p-4 text-center">
              <QRCodeSVG
                value={signaturePageUrl}
                size={280}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#000000"
                title={`Consulta da retirada ${selectedRequest.orderCode}`}
              />
              <p className="mt-3 text-sm font-bold text-slate-900">{selectedRequest.orderCode}</p>
              <p className="text-xs text-gray-600">{selectedRequest.customer} · {selectedRequest.equipmentQuantity} equipamento(s)</p>
              <p className="mt-1 text-[10px] text-gray-500">Código da campanha: {selectedRequest.campaignCode}</p>
              <p className="mt-2 break-all text-[10px] text-gray-400">{signaturePageUrl}</p>
              <button type="button" onClick={() => window.print()} className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-50">
                Imprimir QR Code
              </button>
            </div>
          ) : selectedRequest ? (
            <div role="alert" className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <p className="mt-2 text-sm font-semibold text-amber-900">Este registro não tem QR compartilhável</p>
              <p className="mt-1 text-xs text-amber-800">Ele foi criado antes da configuração do Supabase e só existe neste navegador. Configure o Supabase e gere uma nova retirada para abrir em outros celulares.</p>
            </div>
          ) : (
            <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-slate-50 px-4 text-center">
              <QrCode className="h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">O QR Code aparecerá aqui</p>
              <p className="mt-1 text-xs text-gray-500">Preencha os dados e gere a página para assinatura.</p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Retiradas geradas</h2>
          <span className="text-xs text-gray-500">{loading ? 'Carregando…' : `${requests.length} registro(s)`}</span>
        </div>
        {requests.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">OP / Pedido</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Retirada</th>
                  <th className="py-2 pr-3 font-medium">Código da campanha</th>
                  <th className="py-2 pr-3 font-medium">Registro da Produção</th>
                  <th className="py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((request) => {
                  return (
                    <tr key={request.id} className="text-slate-700">
                      <td className="py-3 pr-3 font-semibold">{request.orderCode}<span className="block font-normal text-gray-500">{request.salesOrder}</span></td>
                      <td className="py-3 pr-3">{request.customer}</td>
                      <td className="py-3 pr-3">{request.pickupDate}</td>
                      <td className="py-3 pr-3">{request.campaignCode}</td>
                      <td className="py-3 pr-3">
                        {request.productionSignature ? (
                          <span className="inline-flex items-start gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-emerald-800">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>Assinado por {request.productionSignature.name}<span className="block text-[10px]">{formatSignatureDate(request.productionSignature.signedAt)}</span></span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={() => setSelectedRequestId(request.id)}
                          className="rounded-md border border-gray-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-gray-50">
                          Ver registro
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-xs text-gray-500">
            Nenhum QR Code gerado ainda.
          </p>
        )}
      </section>
    </div>
  );
}
