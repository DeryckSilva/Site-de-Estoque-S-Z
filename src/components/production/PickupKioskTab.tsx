import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Package, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import type { PickupSignatureRequest } from '../../types/pickupSignature';
import { loadPickupSignatureList, watchPickupSignatures } from '../../services/pickupSignatureService';
import { sharedPickupClient } from '../../services/pickupSignatureStore';

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getSignatureUrl(id: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('view', 'assinatura');
  url.searchParams.set('id', id);
  url.searchParams.set('source', 'tablet');
  return url.toString();
}

function getRecordLabel(request: PickupSignatureRequest): string {
  if (request.recordType === 'test') return 'Registro de teste';
  if (request.recordType === 'adHoc') return 'Saída avulsa';
  return 'Pedido';
}

function formatDate(date: string): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('pt-BR');
}

export function PickupKioskTab() {
  const [requests, setRequests] = useState<PickupSignatureRequest[]>([]);
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refreshRequests = async () => {
    if (!sharedPickupClient) {
      setRequests([]);
      setError('O painel do tablet precisa da conexão compartilhada para carregar os pedidos. Avise o responsável pelo sistema.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setRefreshing(true);
    try {
      const entries = await loadPickupSignatureList();
      setRequests(entries.map(({ request }) => request));
      setError('');
    } catch (loadError) {
      console.error('Falha ao carregar pedidos para retirada pelo tablet:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os pedidos para retirada.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshRequests();
    return watchPickupSignatures(() => void refreshRequests());
  }, []);

  const pendingRequests = useMemo(
    () => requests.filter((request) => !request.productionSignature),
    [requests],
  );
  const normalizedFilter = normalizeSearch(filterText.trim());
  const filteredRequests = pendingRequests.filter((request) => {
    const searchableText = [
      request.salesOrder,
      request.orderCode,
      request.customer,
      request.campaignCode,
      getRecordLabel(request),
    ].join(' ');
    return normalizeSearch(searchableText).includes(normalizedFilter);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Retirada pelo tablet</h1>
            <p className="mt-1 text-sm text-slate-600">Encontre seu pedido, confira os dados e assine o recebimento.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-5 w-5" />
          {pendingRequests.length} retirada(s) aguardando
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Qual pedido você está retirando?</h2>
            <p className="mt-1 text-sm text-slate-600">Toque no pedido correto para abrir a conferência e a assinatura.</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshRequests()}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando…' : 'Atualizar lista'}
          </button>
        </div>

        <label htmlFor="pickup-kiosk-filter" className="sr-only">Buscar pedido ou cliente</label>
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="pickup-kiosk-filter"
            type="search"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Buscar pelo número do pedido ou nome do cliente"
            className="min-h-14 w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-12 pr-4 text-base outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div aria-live="polite">
          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-14 text-center text-slate-600">
              Carregando pedidos pendentes…
            </div>
          ) : !error && filteredRequests.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredRequests.map((request) => {
                const isOrder = request.recordType === 'order' || !request.recordType;
                const recordNumber = isOrder ? request.salesOrder : request.campaignCode;

                return (
                  <a
                    key={request.id}
                    href={getSignatureUrl(request.id)}
                    className="group flex min-h-36 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 sm:p-6"
                  >
                    <span className="min-w-0">
                      <span className="mb-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
                        {getRecordLabel(request)} · aguardando assinatura
                      </span>
                      <span className="block truncate text-xl font-extrabold text-slate-900 sm:text-2xl">{recordNumber}</span>
                      <span className="mt-1 block truncate text-base font-semibold text-slate-700">{request.customer}</span>
                      <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Package className="h-4 w-4" />
                          {request.equipmentQuantity} equipamento(s)
                          {request.chipQuantity > 0 && ` · ${request.chipQuantity} chip(s)`}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4" />
                          Retirada: {formatDate(request.pickupDate)}
                        </span>
                      </span>
                    </span>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white transition group-hover:bg-emerald-800">
                      <ArrowRight className="h-6 w-6" />
                    </span>
                  </a>
                );
              })}
            </div>
          ) : !error ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-3 text-lg font-bold text-slate-800">
                {pendingRequests.length === 0 ? 'Nenhuma retirada aguardando assinatura' : 'Nenhum pedido encontrado'}
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                {pendingRequests.length === 0
                  ? 'Os pedidos aparecem aqui depois que o responsável registra a retirada na aba Assinatura da retirada. Os que já foram assinados ficam somente para consulta.'
                  : 'Confira o número do pedido ou tente buscar pelo nome do cliente.'}
              </p>
            </div>
          ) : null}
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          A lista é compartilhada com o painel de Assinatura da retirada e atualiza automaticamente.
        </p>
      </section>
    </div>
  );
}
