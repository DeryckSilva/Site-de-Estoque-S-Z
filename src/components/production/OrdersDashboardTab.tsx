import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  History,
  LoaderCircle,
  Package,
  Pause,
  Play,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { ORDERS_DATABASE } from '../../data/ordersDatabase';
import { EQUIPMENT_ITEMS } from '../../data/initialData';
import { loadAttendedOrderNumbers, loadOrdersFromGoogleSheet } from '../../services/googleSheetOrders';
import { OrderItem } from '../../types/mapping';
import { BaseOrder } from '../../types/orders';
import { ProductionOrder } from '../../types/production';
import { STORAGE_KEYS } from '../../services/productionSyncService';
import { readPanelProductionOrders } from '../../services/productionOrdersService';

const PENDING_ORDERS_KEY = 'kiraso_pending_ops';
const REFRESH_INTERVAL_KEY = 'kiraso_orders_dashboard_refresh_interval';
const LAST_SYNC_KEY = 'kiraso_orders_dashboard_last_sync';
const SYNC_HISTORY_KEY = 'kiraso_orders_dashboard_sync_history';
const MAX_HISTORY_ENTRIES = 50;
const DEFAULT_REFRESH_INTERVAL = 60;

interface SyncHistoryEntry {
  id: string;
  timestamp: string;
  entradas: number;
  saidas: number;
  status: 'success' | 'error';
  message?: string;
}

function readRefreshInterval(): number {
  const saved = Number(localStorage.getItem(REFRESH_INTERVAL_KEY));
  return [60, 300, 900].includes(saved) ? saved : DEFAULT_REFRESH_INTERVAL;
}

function readLastSync(): string | null {
  const saved = localStorage.getItem(LAST_SYNC_KEY);
  return saved && !Number.isNaN(Date.parse(saved)) ? saved : null;
}

function readSyncHistory(): SyncHistoryEntry[] {
  const saved = localStorage.getItem(SYNC_HISTORY_KEY);
  if (!saved) return [];

  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SyncHistoryEntry =>
      typeof entry?.id === 'string' &&
      typeof entry?.timestamp === 'string' &&
      (entry?.status === 'success' || entry?.status === 'error')
    );
  } catch (error) {
    console.error('Falha ao carregar o histórico de sincronização:', error);
    return [];
  }
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

function readMappingOrders(): OrderItem[] {
  const saved = localStorage.getItem(STORAGE_KEYS.MAPPING_ORDERS);
  if (!saved) return [];

  try {
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed as OrderItem[] : [];
  } catch (error) {
    console.error('Falha ao carregar pedidos do Mapeamento:', error);
    return [];
  }
}

export function OrdersDashboardTab() {
  const [orders, setOrders] = useState<ProductionOrder[]>(readPanelProductionOrders);
  const [mappingOrders, setMappingOrders] = useState<OrderItem[]>(readMappingOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(readRefreshInterval);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(readRefreshInterval);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(readLastSync);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>(readSyncHistory);
  const [syncError, setSyncError] = useState('');
  const refreshInProgress = useRef(false);
  const refreshAction = useRef<() => Promise<void>>(async () => {});

  const refreshOrders = useCallback(async () => {
    if (refreshInProgress.current) return;

    refreshInProgress.current = true;
    setIsRefreshing(true);
    setSyncError('');
    try {
      const [sheetOrders, attendedNumbers] = await Promise.all([
        loadOrdersFromGoogleSheet(),
        loadAttendedOrderNumbers(),
      ]);
      const currentOrders = readMappingOrders();
      const currentByNumber = new Map(
        currentOrders.map((order) => [order.numPed.trim().toLowerCase(), order])
      );
      const activeSheetOrders = sheetOrders.filter(
        (source) => !attendedNumbers.has(source.numPedido.trim().toLowerCase())
      );
      const refreshedOrders = activeSheetOrders.map((source) =>
        toMappingOrder(source, currentByNumber.get(source.numPedido.trim().toLowerCase()))
      );
      const refreshedNumbers = new Set(
        refreshedOrders.map((order) => order.numPed.trim().toLowerCase())
      );
      const manualOrders = currentOrders.filter((order) =>
        order.id.startsWith('ord-') && !refreshedNumbers.has(order.numPed.trim().toLowerCase())
      );
      const nextMappingOrders = [...refreshedOrders, ...manualOrders];
      const currentNumbers = new Set(
        currentOrders.map((order) => order.numPed.trim().toLowerCase())
      );
      const nextNumbers = new Set(
        nextMappingOrders.map((order) => order.numPed.trim().toLowerCase())
      );
      const entradas = [...nextNumbers].filter((number) => !currentNumbers.has(number)).length;
      const saidas = [...currentNumbers].filter((number) => !nextNumbers.has(number)).length;
      const timestamp = new Date().toISOString();
      const successSync: SyncHistoryEntry = {
        id: `${Date.now()}`,
        timestamp,
        entradas,
        saidas,
        status: 'success',
      };
      const nextHistory: SyncHistoryEntry[] = [
        successSync,
        ...readSyncHistory(),
      ].slice(0, MAX_HISTORY_ENTRIES);

      localStorage.setItem(STORAGE_KEYS.MAPPING_ORDERS, JSON.stringify(nextMappingOrders));
      localStorage.setItem(LAST_SYNC_KEY, timestamp);
      localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(nextHistory));
      setMappingOrders(nextMappingOrders);
      setOrders(readPanelProductionOrders());
      setLastSyncAt(timestamp);
      setSyncHistory(nextHistory);
      window.dispatchEvent(new CustomEvent('kiraso_mapping_sync'));
      window.dispatchEvent(new CustomEvent('kiraso_mapping_state_sync'));
    } catch (error) {
      console.error('Falha ao atualizar pedidos pela planilha:', error);
      const message = error instanceof Error ? error.message : 'Falha desconhecida ao atualizar pedidos.';
      const failedSync: SyncHistoryEntry = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        entradas: 0,
        saidas: 0,
        status: 'error',
        message,
      };
      const nextHistory = [failedSync, ...readSyncHistory()].slice(0, MAX_HISTORY_ENTRIES);
      try {
        localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(nextHistory));
        setSyncHistory(nextHistory);
      } catch (storageError) {
        console.error('Falha ao salvar erro no histórico de sincronização:', storageError);
      }
      setSyncError('Não foi possível atualizar. Verifique o acesso às planilhas.');
    } finally {
      refreshInProgress.current = false;
      setIsRefreshing(false);
      setSecondsUntilRefresh(refreshInterval);
    }
  }, [refreshInterval]);

  refreshAction.current = refreshOrders;

  useEffect(() => {
    const syncFromMapping = () => {
      try {
        const mappedOrders = readMappingOrders();
        if (localStorage.getItem(STORAGE_KEYS.MAPPING_ORDERS) === null) return;

        const previousOrders = readPanelProductionOrders();
        const previousByNumber = new Map(previousOrders.map((order) => [order.pedido.toLowerCase(), order]));
        const rawDeliveries = localStorage.getItem(STORAGE_KEYS.MAPPING_DELIVERIES);
        const deliveries = rawDeliveries
          ? JSON.parse(rawDeliveries) as Array<{
              linkedOrderId?: string;
              linkedOrderNumber?: string;
              destinoOuPedido?: string;
              quantidade: number;
            }>
          : [];

        const updatedOrders = mappedOrders.map((mappedOrder): ProductionOrder => {
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

        localStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedOrders));
        setOrders(updatedOrders);
        setMappingOrders(mappedOrders);
      } catch (error) {
        console.error('Falha ao sincronizar pedidos do Mapeamento:', error);
      }
    };

    const refreshOrders = () => {
      setOrders(readPanelProductionOrders());
      setMappingOrders(readMappingOrders());
    };

    window.addEventListener('kiraso_orders_sync', refreshOrders);
    window.addEventListener('kiraso_mapping_state_sync', syncFromMapping);
    window.addEventListener('storage', refreshOrders);
    syncFromMapping();

    return () => {
      window.removeEventListener('kiraso_orders_sync', refreshOrders);
      window.removeEventListener('kiraso_mapping_state_sync', syncFromMapping);
      window.removeEventListener('storage', refreshOrders);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(REFRESH_INTERVAL_KEY, String(refreshInterval));
    setSecondsUntilRefresh(refreshInterval);
  }, [refreshInterval]);

  useEffect(() => {
    void refreshAction.current();
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(() => {
      setSecondsUntilRefresh((remaining) => {
        if (remaining <= 1) {
          void refreshAction.current();
          return refreshInterval;
        }
        return remaining - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPaused, refreshInterval]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR');
    if (!query) return orders;

    return orders.filter((order) => {
      const mappedOrder = mappingOrders.find((candidate) =>
        candidate.numPed.toLowerCase() === order.pedido.toLowerCase()
      );
      const baseOrder = ORDERS_DATABASE.find((candidate) =>
        candidate.numPedido.toLowerCase() === order.pedido.toLowerCase()
      );
      return [
        order.ordem,
        order.pedido,
        order.clienteSolicitante,
        order.itemModel,
        order.origem,
        mappedOrder?.observacao,
        baseOrder?.comercial,
        baseOrder?.geracao,
        baseOrder?.operadora,
        mappedOrder?.comercial,
        mappedOrder?.geracao,
        mappedOrder?.operadora,
      ].some((value) => value?.toLocaleLowerCase('pt-BR').includes(query));
    });
  }, [orders, mappingOrders, searchQuery]);

  const totalQuantity = orders.reduce((sum, order) => sum + (Number(order.totalQtd) || 0), 0);
  const latestSync = syncHistory.find((entry) => entry.status === 'success');
  const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const countdownLabel = `${Math.floor(secondsUntilRefresh / 60)}:${String(secondsUntilRefresh % 60).padStart(2, '0')}`;

  const getOrderData = (order: ProductionOrder) => {
    const mappedOrder = mappingOrders.find((candidate) =>
      candidate.numPed.toLowerCase() === order.pedido.toLowerCase()
    );
    const baseOrder: BaseOrder | undefined = ORDERS_DATABASE.find((candidate) =>
      candidate.numPedido.toLowerCase() === order.pedido.toLowerCase()
    );

    return { mappedOrder, baseOrder };
  };

  const formatDate = (date: string) => {
    if (!date) return '—';
    const localizedDate = date.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (localizedDate) return localizedDate[1];

    const isoDate = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

    const parsedDate = new Date(date);
    return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Painel de Pedidos</h1>
          <p className="mt-1 text-sm text-gray-500">Pedidos atualizados e sincronizados com o Mapeamento.</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
            <span className="block text-[11px] font-medium uppercase text-gray-500">Pedidos</span>
            <span className="text-lg font-bold text-slate-900">{orders.length}</span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
            <span className="block text-[11px] font-medium uppercase text-gray-500">Unidades</span>
            <span className="text-lg font-bold text-slate-900">{totalQuantity.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      <section
        aria-label="Atualização de pedidos"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs"
      >
        <div className="flex min-w-[220px] flex-1 items-center gap-2.5">
          <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isRefreshing ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-blue-600'}`}>
            <Activity className="h-4 w-4" />
            <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${syncError ? 'bg-red-500' : isRefreshing ? 'animate-pulse bg-blue-500' : isPaused ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800">Atualização de Pedidos (Entram &amp; Saem)</span>
              <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${isPaused ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {isPaused ? 'Pausado' : `Automático (${refreshInterval / 60} min)`}
              </span>
            </div>
            <p aria-live="polite" className={`mt-0.5 text-[10px] ${syncError ? 'text-red-600' : 'text-slate-500'}`}>
              {syncError || `Última sincronização: ${lastSyncAt ? formatTimestamp(lastSyncAt) : 'aguardando'} · ${isPaused ? 'Atualização pausada' : isRefreshing ? 'Atualizando agora...' : `Próxima em ${countdownLabel}`}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px]">
          <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
            <ArrowDownLeft className="h-3 w-3" />
            {latestSync?.entradas ?? 0} Entradas
          </span>
          <span className="h-3 w-px bg-slate-300" />
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <ArrowUpRight className="h-3 w-3" />
            {latestSync?.saidas ?? 0} Saídas
          </span>
          <span className="h-3 w-px bg-slate-300" />
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-blue-700"
          >
            <History className="h-3 w-3" />
            Ver Histórico
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            aria-label="Intervalo de atualização"
            value={refreshInterval}
            onChange={(event) => setRefreshInterval(Number(event.target.value))}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            <option value={60}>1 minuto (Padrão)</option>
            <option value={300}>5 minutos</option>
            <option value={900}>15 minutos</option>
          </select>
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isPaused ? 'Retomar' : 'Pausar'}
          </button>
          <button
            type="button"
            onClick={() => void refreshOrders()}
            disabled={isRefreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-700 px-2.5 text-[10px] font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isRefreshing ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar Agora
          </button>
        </div>
      </section>

      {historyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistoryOpen(false);
          }}
        >
          <section
            aria-labelledby="orders-sync-history-title"
            aria-modal="true"
            className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl"
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="orders-sync-history-title" className="text-base font-bold text-slate-900">Histórico de atualizações</h2>
                <p className="mt-0.5 text-xs text-slate-500">Últimas {MAX_HISTORY_ENTRIES} sincronizações deste navegador</p>
              </div>
              <button
                type="button"
                aria-label="Fechar histórico"
                onClick={() => setHistoryOpen(false)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="max-h-[60vh] overflow-y-auto">
              {syncHistory.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">Ainda não há atualizações registradas.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {syncHistory.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div>
                        <p className={`text-xs font-semibold ${entry.status === 'error' ? 'text-red-700' : 'text-slate-800'}`}>
                          {entry.status === 'error' ? 'Falha na sincronização' : 'Sincronização concluída'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {new Date(entry.timestamp).toLocaleString('pt-BR')}
                          {entry.message ? ` · ${entry.message}` : ''}
                        </p>
                      </div>
                      {entry.status === 'success' && (
                        <span className="shrink-0 text-[10px]">
                          <span className="font-semibold text-blue-700">+{entry.entradas}</span>
                          <span className="mx-1 text-slate-400">/</span>
                          <span className="font-semibold text-emerald-700">−{entry.saidas}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar por pedido, cliente, modelo ou operadora..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Data</th>
                <th className="px-3 py-3">Nº do pedido</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3 text-center">Quantidade</th>
                <th className="px-3 py-3">Modelo</th>
                <th className="px-3 py-3">Geração</th>
                <th className="px-3 py-3">Operadora</th>
                <th className="px-3 py-3">Carregador</th>
                <th className="px-4 py-3 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                    {orders.length === 0 ? 'Nenhum pedido disponível.' : 'Nenhum pedido encontrado.'}
                  </td>
                </tr>
              ) : filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const { mappedOrder, baseOrder } = getOrderData(order);
                const model = baseOrder?.modeloVariacao || mappedOrder?.modeloDesc || order.itemModel;
                const generation = baseOrder?.geracao || mappedOrder?.geracao || '—';
                const operator = baseOrder?.operadora || mappedOrder?.operadora || '—';
                const charger = baseOrder?.carregador || mappedOrder?.carregador || '—';

                return (
                  <React.Fragment key={order.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(baseOrder?.dataSolicitacao || order.dataCriacao)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono font-semibold text-slate-900">
                        {order.pedido}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-slate-700">
                        {baseOrder?.cliente || order.clienteSolicitante}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-800">
                        {Number(order.totalQtd || 0).toLocaleString('pt-BR')}
                      </td>
                      <td className="max-w-[190px] truncate px-3 py-3 text-slate-700">{model}</td>
                      <td className="px-3 py-3 text-slate-700">{generation}</td>
                      <td className="px-3 py-3 text-slate-700">{operator}</td>
                      <td className="px-3 py-3 text-slate-500">{charger}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 px-2.5 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {isExpanded ? 'Fechar' : 'Ver detalhes'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={9} className="px-5 py-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Package className="h-4 w-4 text-blue-600" />
                            Informações completas do pedido
                          </div>
                          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                              ['Nº da ordem', order.ordem],
                              ['Pedido', order.pedido],
                              ['Cliente', baseOrder?.cliente || order.clienteSolicitante],
                              ['CNPJ', baseOrder?.cnpj || mappedOrder?.cnpj],
                              ['Data da solicitação', baseOrder?.dataSolicitacao || mappedOrder?.dataSolicitacao || order.dataCriacao],
                              ['Data de envio', baseOrder?.dataEnvio || mappedOrder?.dataEnvio],
                              ['Quantidade', String(order.totalQtd)],
                              ['Modelo', model],
                              ['Geração', generation],
                              ['Operadora', operator],
                              ['Tipo de item', baseOrder?.tipoItem || mappedOrder?.tipoItem],
                              ['Variação', baseOrder?.corVariacao || mappedOrder?.corVariacao || mappedOrder?.modeloVariacao],
                              ['Tipo de negócio', baseOrder?.tipoNegocio || mappedOrder?.tipoNegocio],
                              ['Tipo de entrega', baseOrder?.tipoEntrega || mappedOrder?.tipoEntrega],
                              ['Comercial', baseOrder?.comercial || mappedOrder?.comercial],
                              ['Contrato', baseOrder?.contrato || mappedOrder?.contrato],
                              ['Carregador', charger],
                              ['Quantidade de carregadores', String(baseOrder?.quantidadeCarregador || mappedOrder?.quantidadeCarregador || '')],
                              ['Peças destinadas', String(Math.min(order.destinado || 0, order.totalQtd))],
                              ['Observações', mappedOrder?.observacao || baseOrder?.observacao || order.observacoes],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <dt className="text-[11px] font-medium uppercase text-gray-500">{label}</dt>
                                <dd className="mt-0.5 break-words text-sm text-slate-800">{value || 'Não informado'}</dd>
                              </div>
                            ))}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
