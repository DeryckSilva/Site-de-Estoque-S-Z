import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, CheckCircle2, ClipboardList, ExternalLink, Plus, QrCode } from 'lucide-react';
import type { ProductionOrder } from '../../types/production';
import type { PickupSignatureRequest } from '../../types/pickupSignature';
import { loadPickupSignatures, savePickupSignature, watchPickupSignatures } from '../../services/pickupSignatureService';
import { readPanelProductionOrders } from '../../services/productionOrdersService';
import { sharedWmsClient } from '../../services/sharedWmsStore';

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
  const signaturePageUrl = selectedRequest ? getSignatureUrl(selectedRequest.id) : '';

  const createRequest = async () => {
    if (!sharedWmsClient) {
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
            <p className="text-xs text-gray-500">Gere o QR Code do pedido para registrar o recebimento pela Produção e pela Logística.</p>
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

      {!sharedWmsClient && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>O Supabase compartilhado não está configurado neste site. As campanhas ficam neste navegador e não abrem pelo QR em outros dispositivos. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no GitHub e publique novamente.</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-900">Dados do pedido e retirada</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-slate-700 sm:col-span-2">
              Pedido do Painel de Pedidos
              <select
                value={selectedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>{order.ordem} · {order.pedido} · {order.itemModel}</option>
                ))}
              </select>
            </label>
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
          <button type="button" onClick={() => void createRequest()} disabled={saving || !selectedOrder || !sharedWmsClient}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" /> {saving ? 'Gerando...' : sharedWmsClient ? 'Gerar QR Code da retirada' : 'Configure o Supabase para gerar QR'}
          </button>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">QR Code para assinatura</h2>
            {selectedRequest && (
              <a href={signaturePageUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900">
                Abrir página <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {selectedRequest ? (
            <div id="pickup-signature-qr-print" className="flex flex-col items-center rounded-lg border border-gray-100 bg-white p-4 text-center">
              <QRCodeSVG
                value={signaturePageUrl}
                size={280}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#000000"
                title={`Assinatura ${selectedRequest.orderCode}`}
              />
              <p className="mt-3 text-sm font-bold text-slate-900">{selectedRequest.orderCode}</p>
              <p className="text-xs text-gray-600">{selectedRequest.customer} · {selectedRequest.equipmentQuantity} equipamento(s)</p>
              <p className="mt-1 text-[10px] text-gray-500">Código da campanha: {selectedRequest.campaignCode}</p>
              <p className="mt-2 break-all text-[10px] text-gray-400">{signaturePageUrl}</p>
              <button type="button" onClick={() => window.print()} className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-50">
                Imprimir QR Code
              </button>
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
                  <th className="py-2 pr-3 font-medium">Assinaturas</th>
                  <th className="py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((request) => {
                  const signedCount = Number(Boolean(request.productionSignature)) + Number(Boolean(request.logisticsSignature));
                  return (
                    <tr key={request.id} className="text-slate-700">
                      <td className="py-3 pr-3 font-semibold">{request.orderCode}<span className="block font-normal text-gray-500">{request.salesOrder}</span></td>
                      <td className="py-3 pr-3">{request.customer}</td>
                      <td className="py-3 pr-3">{request.pickupDate}</td>
                      <td className="py-3 pr-3">{request.campaignCode}</td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${signedCount === 2 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> {signedCount}/2
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={() => setSelectedRequestId(request.id)}
                          className="rounded-md border border-gray-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-gray-50">
                          Ver QR
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
