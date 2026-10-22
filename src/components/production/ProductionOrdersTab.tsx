import React, { useState, useMemo, useEffect } from 'react';
import {
  Factory,
  Search,
  ChevronRight,
  ChevronDown,
  Check,
  ArrowRight,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  FileSpreadsheet,
  Cpu,
  RotateCcw,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { ProductionOrder, ProductionPriority, SerialUnit } from '../../types/production';
import { OrderItem } from '../../types/mapping';
import { EQUIPMENT_ITEMS } from '../../data/initialData';
import { STORAGE_KEYS } from '../../services/productionSyncService';
import {
  INITIAL_PRODUCTION_ORDERS,
  INITIAL_IN_PROGRESS_ORDERS,
  INITIAL_SERIAL_UNITS,
} from '../../data/productionOrdersData';
import { AttendedOrdersTable } from './AttendedOrdersTable';
import { FinalizeBaixaModal } from './FinalizeBaixaModal';
import { getAttendedOrders } from '../../services/attendedOrdersService';

interface ProductionOrdersTabProps {
  onNavigateToMapping?: () => void;
}

export function ProductionOrdersTab({ onNavigateToMapping }: ProductionOrdersTabProps) {
  const [subTab, setSubTab] = useState<'atender'>('atender');
  const [searchQuery, setSearchQuery] = useState('');
  const [destinedFilter, setDestinedFilter] = useState<'all' | 'destined' | 'pending'>('all');
  const [isBaixaModalOpen, setIsBaixaModalOpen] = useState(false);
  const [orderForBaixa, setOrderForBaixa] = useState<ProductionOrder | null>(null);
  const [attendedCount, setAttendedCount] = useState<number>(() => getAttendedOrders().length);

  // Orders state
  const [pendingOrders, setPendingOrders] = useState<ProductionOrder[]>(() => {
    const saved = localStorage.getItem('kiraso_pending_ops');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_PRODUCTION_ORDERS;
  });

  const [activeOrders, setActiveOrders] = useState<ProductionOrder[]>(() => {
    const saved = localStorage.getItem('kiraso_active_ops');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_IN_PROGRESS_ORDERS;
  });

  const [serialUnits, setSerialUnits] = useState<SerialUnit[]>(() => {
    const saved = localStorage.getItem('kiraso_serial_units');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_SERIAL_UNITS;
  });

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Modal / Atender drawer state
  const [orderToAttend, setOrderToAttend] = useState<ProductionOrder | null>(null);
  const [attendQuantity, setAttendQuantity] = useState<number>(1);
  const [attendTechnician, setAttendTechnician] = useState<string>('Deryck Silva');
  const [attendBench, setAttendBench] = useState<string>('Bancada 01');
  const [attendNotes, setAttendNotes] = useState<string>('');

  // New Production Form State
  const [newOpCode, setNewOpCode] = useState(`OP-2026-00${43 + pendingOrders.length}`);
  const [newPvCode, setNewPvCode] = useState(`PV-2026-00${12 + pendingOrders.length}`);
  const [newClient, setNewClient] = useState('');
  const [newItemModel, setNewItemModel] = useState('ST - 4410G (4G)');
  const [newQuantity, setNewQuantity] = useState<number>(10);
  const [newPriority, setNewPriority] = useState<ProductionPriority>('Padrão');
  const [newDestined, setNewDestined] = useState<number>(0);
  const [newNotes, setNewNotes] = useState('');

  // Save to local storage
  const saveState = (pending: ProductionOrder[], active: ProductionOrder[], units: SerialUnit[]) => {
    setPendingOrders(pending);
    setActiveOrders(active);
    setSerialUnits(units);
    localStorage.setItem('kiraso_pending_ops', JSON.stringify(pending));
    localStorage.setItem('kiraso_active_ops', JSON.stringify(active));
    localStorage.setItem('kiraso_serial_units', JSON.stringify(units));
  };

  const syncPendingFromMapping = () => {
    try {
      const rawOrders = localStorage.getItem(STORAGE_KEYS.MAPPING_ORDERS);
      if (!rawOrders) return;
      const mappingOrders = JSON.parse(rawOrders) as OrderItem[];
      const rawDeliveries = localStorage.getItem(STORAGE_KEYS.MAPPING_DELIVERIES);
      const deliveries = rawDeliveries ? JSON.parse(rawDeliveries) as Array<{ linkedOrderId?: string; linkedOrderNumber?: string; destinoOuPedido?: string; quantidade: number }> : [];
      const savedPending = localStorage.getItem('kiraso_pending_ops');
      const previousOrders = savedPending ? JSON.parse(savedPending) as ProductionOrder[] : [];
      const previous = new Map(previousOrders.map((order) => [order.pedido.toLowerCase(), order]));
      const next = mappingOrders.map((order): ProductionOrder => {
        const previousOrder = previous.get(order.numPed.toLowerCase());
        const destined = deliveries
          .filter((delivery) => delivery.linkedOrderId === order.id || delivery.linkedOrderNumber?.toLowerCase() === order.numPed.toLowerCase() || (delivery.destinoOuPedido || '').toLowerCase().includes(order.numPed.toLowerCase()))
          .reduce((sum, delivery) => sum + (Number(delivery.quantidade) || 0), 0) || order.destinadoProducao || 0;
        const total = Number(order.quantidade) || 0;
        const produced = Math.min(previousOrder?.produzido || 0, total);
        return {
          id: previousOrder?.id || `op-${order.id}`,
          prioridade: previousOrder?.prioridade || 'Padrão',
          ordem: previousOrder?.ordem || `OP-${order.numPed}`,
          origem: previousOrder?.origem || 'Pedido de Venda',
          tipoOrigemBadge: previousOrder?.tipoOrigemBadge || order.tipoNegocio || 'Pedido',
          clienteSolicitante: order.cliente,
          pedido: order.numPed,
          itemModel: order.modeloDesc || EQUIPMENT_ITEMS.find((item) => item.id === order.itemId)?.name || order.itemId,
          produzido: produced,
          falta: Math.max(0, total - produced),
          totalQtd: total,
          destinado: Math.min(total, destined),
          dataCriacao: previousOrder?.dataCriacao || order.dataEnvio || new Date().toLocaleDateString('pt-BR'),
          status: 'A atender',
          bancada: previousOrder?.bancada || 'Bancada 01',
          observacoes: order.observacao || previousOrder?.observacoes,
        };
      });
      setPendingOrders(next);
      localStorage.setItem('kiraso_pending_ops', JSON.stringify(next));
    } catch (error) {
      console.error('Falha ao espelhar Comprometidas em A atender:', error);
    }
  };

  // Real-time synchronization listener with Mapeamento de Produção
  useEffect(() => {
    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.updatedOps) {
        setPendingOrders(customEvent.detail.updatedOps);
      } else {
        const saved = localStorage.getItem('kiraso_pending_ops');
        if (saved) {
          try {
            setPendingOrders(JSON.parse(saved));
          } catch (e) {
            console.error(e);
          }
        }
      }
    };

    window.addEventListener('kiraso_orders_sync', handleSync);
    window.addEventListener('storage', handleSync);
    
    const handleAttendedSync = () => {
      setAttendedCount(getAttendedOrders().length);
      const saved = localStorage.getItem('kiraso_pending_ops');
      if (saved) {
        try {
          setPendingOrders(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    };
    window.addEventListener('kiraso_attended_sync', handleAttendedSync);
    window.addEventListener('kiraso_mapping_state_sync', syncPendingFromMapping);
    syncPendingFromMapping();

    return () => {
      window.removeEventListener('kiraso_orders_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('kiraso_attended_sync', handleAttendedSync);
      window.removeEventListener('kiraso_mapping_state_sync', syncPendingFromMapping);
    };
  }, []);

  // Reset to default
  const handleReset = () => {
    if (confirm('Deseja restaurar as Ordens de Produção para o estado original da imagem?')) {
      saveState(INITIAL_PRODUCTION_ORDERS, INITIAL_IN_PROGRESS_ORDERS, INITIAL_SERIAL_UNITS);
    }
  };

  // Filter pending orders
  const filteredPendingOrders = useMemo(() => {
    return pendingOrders.filter((order) => {
      if (destinedFilter === 'destined' && (!order.destinado || order.destinado <= 0)) {
        return false;
      }
      if (destinedFilter === 'pending' && order.destinado && order.destinado > 0) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        order.ordem.toLowerCase().includes(q) ||
        order.origem.toLowerCase().includes(q) ||
        order.clienteSolicitante.toLowerCase().includes(q) ||
        order.pedido.toLowerCase().includes(q) ||
        order.itemModel.toLowerCase().includes(q)
      );
    });
  }, [pendingOrders, searchQuery, destinedFilter]);

  const totalDestinedCount = pendingOrders.filter((o) => o.destinado > 0).length;

  const getAvailableDestinedQuantity = (order: ProductionOrder) =>
    Math.max(0, (Number(order.destinado) || 0) - (Number(order.produzido) || 0));

  // Handle open Atender modal
  const handleOpenAttendModal = (order: ProductionOrder) => {
    setOrderToAttend(order);
    setAttendQuantity(order.falta > 0 ? order.falta : order.totalQtd);
    setAttendTechnician('Deryck Silva');
    setAttendBench(order.bancada || 'Bancada 01');
    setAttendNotes(order.observacoes || '');
  };

  // Handle open Dar Baixa modal
  const handleOpenBaixaModal = (order: ProductionOrder) => {
    const remainingQuantity = Math.max(0, Number(order.falta) || Number(order.totalQtd) || 0);
    const availableDestined = getAvailableDestinedQuantity(order);
    if (availableDestined < remainingQuantity) {
      alert(`A Logística destinou ${availableDestined} de ${remainingQuantity} equipamento(s). A baixa só é liberada quando toda a quantidade estiver destinada.`);
      return;
    }
    setOrderForBaixa(order);
    setIsBaixaModalOpen(true);
  };

  // Confirm Atender order -> moves or adds to active orders
  const handleConfirmAttend = () => {
    if (!orderToAttend) return;

    // Check if producing partial or total
    const qtyToProduce = Number(attendQuantity) || 1;
    const availableDestined = getAvailableDestinedQuantity(orderToAttend);

    if (availableDestined <= 0) {
      alert('A Logística ainda não destinou equipamentos para este pedido. A Produção não pode atendê-lo.');
      return;
    }

    if (qtyToProduce > availableDestined) {
      alert(`Apenas ${availableDestined} equipamento(s) foram destinado(s) pela Logística e estão disponíveis para produção.`);
      return;
    }

    // Create or update active production
    const updatedPending = pendingOrders
      .map((op) => {
        if (op.id === orderToAttend.id) {
          const remainingFalta = Math.max(0, op.falta - qtyToProduce);
          const newProduced = op.produzido + qtyToProduce;
          return {
            ...op,
            falta: remainingFalta,
            produzido: newProduced,
          };
        }
        return op;
      })
      .filter((op) => op.falta > 0); // If completed, remove from "A atender"

    // Add to Active in Painel
    const newActiveOrder: ProductionOrder = {
      ...orderToAttend,
      id: `op-active-${Date.now()}`,
      status: 'Fila de Bancada',
      totalQtd: qtyToProduce,
      produzido: 0,
      falta: qtyToProduce,
      tecnicoResponsavel: attendTechnician,
      bancada: attendBench,
      observacoes: attendNotes,
      dataCriacao: new Date().toLocaleString('pt-BR'),
    };

    // Auto generate serialized units draft
    const newUnits: SerialUnit[] = Array.from({ length: qtyToProduce }).map((_, idx) => ({
      id: `u-${Date.now()}-${idx}`,
      serialNumber: `SN-${orderToAttend.ordem.replace('OP-', '')}-${String(idx + 1).padStart(3, '0')}`,
      imei: `8642910${Math.floor(10000000 + Math.random() * 90000000)}`,
      ordemId: newActiveOrder.id,
      ordemCodigo: orderToAttend.ordem,
      itemModel: orderToAttend.itemModel,
      status: 'Gravado',
      dataHora: new Date().toLocaleString('pt-BR'),
      tecnico: attendTechnician,
    }));

    saveState(updatedPending, [newActiveOrder, ...activeOrders], [...newUnits, ...serialUnits]);
    setOrderToAttend(null);
    setSubTab('painel');
  };

  // Handle Create New OP
  const handleCreateNewOP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.trim()) {
      alert('Informe o cliente ou solicitante.');
      return;
    }

    const newOrder: ProductionOrder = {
      id: `op-${Date.now()}`,
      prioridade: newPriority,
      ordem: newOpCode,
      origem: 'Pedido de Venda',
      tipoOrigemBadge: 'Fatura',
      clienteSolicitante: newClient,
      pedido: newPvCode,
      itemModel: newItemModel,
      produzido: 0,
      falta: Number(newQuantity) || 1,
      totalQtd: Number(newQuantity) || 1,
      destinado: Number(newDestined) || 0,
      dataCriacao: new Date().toLocaleString('pt-BR'),
      status: 'A atender',
      observacoes: newNotes,
    };

    saveState([newOrder, ...pendingOrders], activeOrders, serialUnits);
    setSubTab('atender');
    setNewClient('');
    setNewNotes('');
    setNewOpCode(`OP-2026-00${44 + pendingOrders.length}`);
    setNewPvCode(`PV-2026-00${13 + pendingOrders.length}`);
  };

  // Move active order status in Kanban
  const handleAdvanceStatus = (orderId: string, nextStatus: ProductionOrder['status']) => {
    if (nextStatus === 'Concluído') {
      const target = activeOrders.find((o) => o.id === orderId);
      if (target) {
        setOrderForBaixa(target);
        setIsBaixaModalOpen(true);
      }
    }

    const updated = activeOrders.map((o) => {
      if (o.id === orderId) {
        const isDone = nextStatus === 'Concluído';
        return {
          ...o,
          status: nextStatus,
          produzido: isDone ? o.totalQtd : o.produzido,
          falta: isDone ? 0 : o.falta,
        };
      }
      return o;
    });
    saveState(pendingOrders, updated, serialUnits);
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Header Section as in Image */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-700 shadow-sm">
            <Factory className="h-5 w-5 text-slate-800" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ordens de Produção</h1>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">DERYCK SILVA</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToMapping && (
            <button
              onClick={onNavigateToMapping}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-gray-50 shadow-sm transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
              Ver Mapeamento Online
            </button>
          )}
          <button
            onClick={handleReset}
            title="Restaurar dados originais"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-slate-700 shadow-sm transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Padrão da Imagem
          </button>
        </div>
      </div>

      {/* Tabs Navigation as shown in image */}
      <div className="flex border-b border-gray-200 text-sm">
        <button
          onClick={() => setSubTab('atender')}
          className={`pb-3 pt-1 px-4 font-medium transition-colors relative ${
            subTab === 'atender'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-slate-800'
          }`}
        >
          A atender
          {pendingOrders.length > 0 && (
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 font-semibold border border-blue-100">
              {pendingOrders.length}
            </span>
          )}
        </button>

      </div>

      {/* Subtab 1: A atender (The exact view from user image) */}
      {subTab === 'atender' && (
        <div className="space-y-4">
          {/* Action Bar: Search, Filters, Link Button, Mapping Shortcut */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
              {/* Search Box */}
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ordem, origem, cliente ou pedido..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDestinedFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    destinedFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-gray-500 hover:text-slate-800'
                  }`}
                >
                  Todos ({pendingOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDestinedFilter('destined')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                    destinedFilter === 'destined'
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-emerald-700'
                  }`}
                >
                  <Check className="h-3 w-3" />
                  <span>Com Peças ({totalDestinedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDestinedFilter('pending')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    destinedFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-amber-700'
                  }`}
                >
                  Aguardando ({pendingOrders.length - totalDestinedCount})
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onNavigateToMapping && (
                <button
                  type="button"
                  onClick={onNavigateToMapping}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-gray-50 shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span>Mapeamento Online</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Container exactly as in image */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-white text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="py-3.5 pl-4 pr-2 w-28">PRIOR.</th>
                    <th className="py-3.5 px-3">ORDEM</th>
                    <th className="py-3.5 px-3">ORIGEM</th>
                    <th className="py-3.5 px-3">CLIENTE / SOLICITANTE</th>
                    <th className="py-3.5 px-3">PEDIDO</th>
                    <th className="py-3.5 px-3 text-center">PRODUZIDO</th>
                    <th className="py-3.5 px-3 text-center">FALTA</th>
                    <th className="py-3.5 px-3 text-center">DESTINADO</th>
                    <th className="py-3.5 pr-4 text-right">AÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredPendingOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400 text-sm">
                        Nenhuma ordem encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredPendingOrders.map((item) => {
                      const isExpanded = expandedOrderId === item.id;
                      const hasDestined = item.destinado > 0;
                      const availableDestined = getAvailableDestinedQuantity(item);
                      const isComplete = item.destinado >= item.totalQtd;

                      return (
                        <React.Fragment key={item.id}>
                          <tr className={`hover:bg-slate-50/60 transition-colors ${hasDestined ? 'bg-emerald-50/20' : ''}`}>
                            {/* Prioridade with chevron */}
                            <td className="py-3 pl-4 pr-2">
                              <button
                                onClick={() => setExpandedOrderId(isExpanded ? null : item.id)}
                                className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium text-xs group"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-slate-800" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-slate-800" />
                                )}
                                <span>{item.prioridade}</span>
                              </button>
                            </td>

                            {/* Ordem */}
                            <td className="py-3 px-3 font-semibold text-slate-900">
                              {item.ordem}
                            </td>

                            {/* Origem + Fatura badge */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-700 text-sm">{item.origem}</span>
                                {item.tipoOrigemBadge && (
                                  <span className="rounded bg-[#1e3a8a] text-white text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                                    {item.tipoOrigemBadge}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Cliente / Solicitante */}
                            <td className="py-3 px-3 text-slate-600">
                              <span className="truncate block max-w-[240px] text-xs">
                                {item.clienteSolicitante}
                              </span>
                            </td>

                            {/* Pedido */}
                            <td className="py-3 px-3 text-slate-700 text-xs font-mono font-bold text-red-700">
                              {item.pedido}
                            </td>

                            {/* Produzido */}
                            <td className="py-3 px-3 text-center text-slate-700 font-medium">
                              {item.produzido}
                            </td>

                            {/* Falta */}
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {item.falta}
                            </td>

                            {/* Destinado (badge with check or 0, synced from Mapeamento) */}
                            <td className="py-3 px-3 text-center">
                              {hasDestined ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300 shadow-xs">
                                    <Check className="h-3 w-3 text-emerald-700 stroke-[3]" />
                                    <span>{item.destinado}</span>
                                  </span>
                                  <span className="text-[9px] font-semibold text-emerald-700 mt-0.5">
                                    {isComplete ? '✓ Pronto Bancada' : 'Parcial'}
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex flex-col items-center">
                                  <span className="text-gray-400 font-medium text-xs">0</span>
                                  {onNavigateToMapping && (
                                    <button
                                      type="button"
                                      onClick={onNavigateToMapping}
                                      className="text-[9px] text-blue-600 hover:underline font-semibold"
                                      title="Ir para o Mapeamento e destinar peças a este pedido"
                                    >
                                      Destinar peças
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Actions: Dar Baixa & Atender */}
                            <td className="py-3 pr-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenBaixaModal(item)}
                                  disabled={availableDestined < item.falta}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all ${availableDestined < item.falta ? 'cursor-not-allowed bg-slate-300' : 'bg-emerald-700 hover:bg-emerald-800 active:scale-95'}`}
                                  title={availableDestined < item.falta ? `Aguardando destinação total: ${availableDestined} de ${item.falta}` : 'Dar baixa no pedido e registrar na planilha de atendidos'}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>{availableDestined < item.falta ? 'Aguardando Logística' : 'Dar Baixa'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded row with model specifications and vinculations */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 border-b border-gray-100">
                              <td colSpan={9} className="py-3 px-6 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 py-1">
                                  <div>
                                    <span className="font-semibold text-gray-500 block">Equipamento / Modelo:</span>
                                    <span className="text-slate-800 font-medium text-sm">{item.itemModel}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-500 block">Status de Destinação:</span>
                                    <span className={`font-semibold ${hasDestined ? 'text-emerald-700' : 'text-amber-700'}`}>
                                      {hasDestined
                                        ? `✓ ${item.destinado} de ${item.totalQtd} unid. entregues pelo Mapeamento`
                                        : 'Aguardando entrega de peças no Mapeamento'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-500 block">Data de Criação:</span>
                                    <span className="text-slate-700">{item.dataCriacao}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-500 block">Observações:</span>
                                    <span className="text-slate-700">{item.observacoes || 'Nenhuma observação informada.'}</span>
                                  </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-gray-200/60 flex items-center justify-between text-gray-500">
                                  <span>Bancada recomendada: <strong>{item.bancada || 'Livre'}</strong></span>
                                  {onNavigateToMapping && (
                                    <button
                                      type="button"
                                      onClick={onNavigateToMapping}
                                      className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline"
                                    >
                                      <FileSpreadsheet className="h-3.5 w-3.5" />
                                      <span>Ver e ajustar no Mapeamento de Produção</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Explanatory Caption as in the image */}
          <div className="text-xs text-gray-400 leading-relaxed max-w-4xl pt-1">
            A fila vem ordenada por prioridade — crítica no topo — e, dentro da mesma prioridade, pela mais antiga.
            A Produção só pode dar baixa após a Logística destinar equipamentos. A coluna{' '}
            <strong className="text-gray-500 font-semibold">DESTINADO</strong> mostra quantos equipamentos já foram vinculados ao
            pedido no Mapeamento de Produção.
          </div>
        </div>
      )}

      {/* Subtab 2: Painel de Produção (5) - Kanban */}
      {subTab === 'painel' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Acompanhe os lotes em andamento nas bancadas, gravação e testes finais.
            </p>
            <button
              onClick={() => setSubTab('nova')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Ordem
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { status: 'Fila de Bancada', title: 'Fila de Bancada', color: 'border-slate-300' },
              { status: 'Gravação / Firmware', title: 'Gravação / Firmware', color: 'border-blue-400' },
              { status: 'Montagem e Bateria', title: 'Montagem e Bateria', color: 'border-amber-400' },
              { status: 'Testes de Comunicação', title: 'Testes / Qualidade', color: 'border-emerald-400' },
            ].map((col) => {
              const ordersInCol = activeOrders.filter((o) => o.status === col.status);
              return (
                <div
                  key={col.status}
                  className={`rounded-xl border ${col.color} bg-white p-3 shadow-xs flex flex-col min-h-[380px]`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {col.title}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                      {ordersInCol.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2.5 flex-1">
                    {ordersInCol.length === 0 ? (
                      <div className="h-32 flex items-center justify-center text-xs text-gray-400">
                        Nenhuma ordem nesta etapa
                      </div>
                    ) : (
                      ordersInCol.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-gray-200 bg-slate-50/50 p-2.5 text-xs hover:border-blue-300 hover:shadow-xs transition-all space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-slate-900">{item.ordem}</span>
                            <span className="text-[10px] text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded font-mono">
                              {item.pedido}
                            </span>
                          </div>

                          <div className="text-slate-800 font-medium truncate" title={item.itemModel}>
                            {item.itemModel}
                          </div>

                          <div className="flex items-center justify-between text-gray-500 text-[11px]">
                            <span>Resp: <strong>{item.tecnicoResponsavel || 'Deryck Silva'}</strong></span>
                            <span>{item.bancada || 'Bancada 01'}</span>
                          </div>

                          {/* Progress bar */}
                          <div className="pt-1">
                            <div className="flex justify-between text-[10px] text-gray-500 pb-0.5">
                              <span>Produzido: {item.produzido}/{item.totalQtd}</span>
                              <span>{Math.round((item.produzido / item.totalQtd) * 100)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (item.produzido / item.totalQtd) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Next Action */}
                          <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">{item.clienteSolicitante}</span>
                            {col.status === 'Fila de Bancada' && (
                              <button
                                onClick={() => handleAdvanceStatus(item.id, 'Gravação / Firmware')}
                                className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Iniciar gravação <ArrowRight className="h-2.5 w-2.5" />
                              </button>
                            )}
                            {col.status === 'Gravação / Firmware' && (
                              <button
                                onClick={() => handleAdvanceStatus(item.id, 'Montagem e Bateria')}
                                className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                              >
                                Ir p/ montagem <ArrowRight className="h-2.5 w-2.5" />
                              </button>
                            )}
                            {col.status === 'Montagem e Bateria' && (
                              <button
                                onClick={() => handleAdvanceStatus(item.id, 'Testes de Comunicação')}
                                className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
                              >
                                Ir p/ testes <ArrowRight className="h-2.5 w-2.5" />
                              </button>
                            )}
                            {col.status === 'Testes de Comunicação' && (
                              <button
                                onClick={() => handleAdvanceStatus(item.id, 'Concluído')}
                                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                Concluir <Check className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtab 3: Nova Produção */}
      {subTab === 'nova' && (
        <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Cadastrar Nova Ordem de Produção</h2>
              <p className="text-xs text-gray-500">
                A nova ordem entrará automaticamente na fila "A atender" com integração ao Mapeamento.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateNewOP} className="mt-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Código da Ordem (OP)</label>
                <input
                  type="text"
                  required
                  value={newOpCode}
                  onChange={(e) => setNewOpCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Pedido de Venda (PV)</label>
                <input
                  type="text"
                  required
                  value={newPvCode}
                  onChange={(e) => setNewPvCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Cliente / Solicitante</label>
                <input
                  type="text"
                  required
                  placeholder="ex: marcos.santos@sezseg.com.br"
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Equipamento / Modelo</label>
                <select
                  value={newItemModel}
                  onChange={(e) => setNewItemModel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 bg-white"
                >
                  <option value="ST - 4410G (4G) - Bat 3800">ST - 4410G (4G) - Bat 3800</option>
                  <option value="ST - 410G (2G) - Standard">ST - 410G (2G) - Standard</option>
                  <option value="TAG MINI CARD">TAG MINI CARD</option>
                  <option value="ST - 8410 (4G)">ST - 8410 (4G)</option>
                  <option value="QUECK 4G BATERIA 3.800">QUECK 4G BATERIA 3.800</option>
                  <option value="ST - 8380 4G BATERIA 10.000">ST - 8380 4G BATERIA 10.000</option>
                  <option value="LT - 32 (4G)">LT - 32 (4G)</option>
                  <option value="TAG CARD Santa Cruz">TAG CARD Santa Cruz</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Quantidade Necessária</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Prioridade</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as ProductionPriority)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 bg-white"
                >
                  <option value="Crítica">Crítica (topo da fila)</option>
                  <option value="Alta">Alta</option>
                  <option value="Padrão">Padrão</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Já Destinado (Mapeamento)</label>
                <input
                  type="number"
                  min="0"
                  value={newDestined}
                  onChange={(e) => setNewDestined(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Observações Técnicas</label>
              <textarea
                rows={2}
                placeholder="Instruções de gravação, versão de firmware, cabos ou kits especiais..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSubTab('atender')}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
              >
                Criar Ordem e Enviar p/ Fila
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtab 4: Unidades */}
      {subTab === 'unidades' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Unidades Serializadas em Produção</h3>
              <p className="text-xs text-gray-500">Controle de Serial Number e IMEI gravados</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {serialUnits.length} rastreadas
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-slate-50 text-[11px] font-semibold text-gray-500 uppercase">
                  <th className="py-2.5 px-3">Serial</th>
                  <th className="py-2.5 px-3">IMEI</th>
                  <th className="py-2.5 px-3">Ordem (OP)</th>
                  <th className="py-2.5 px-3">Modelo</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Técnico</th>
                  <th className="py-2.5 px-3 text-right">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {serialUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{u.serialNumber}</td>
                    <td className="py-2.5 px-3 font-mono text-gray-600">{u.imei || '—'}</td>
                    <td className="py-2.5 px-3 text-blue-700 font-medium">{u.ordemCodigo}</td>
                    <td className="py-2.5 px-3 text-slate-800">{u.itemModel}</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{u.tecnico}</td>
                    <td className="py-2.5 px-3 text-right text-gray-500">{u.dataHora}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab: Pedidos atendidos / Histórico de pedidos finalizados */}
      {(subTab === 'baixas' || subTab === 'historico') && (
        <div className="space-y-4">
          <AttendedOrdersTable
            onNavigateToProductionQueue={() => setSubTab('atender')}
            onNavigateToMapping={onNavigateToMapping}
          />
        </div>
      )}

      {/* Modal / Dialog: Atender Ordem */}
      {orderToAttend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a8a] text-white">
                  <Play className="h-4 w-4 fill-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Atender Ordem de Produção</h3>
                  <p className="text-[11px] text-gray-500 font-mono">{orderToAttend.ordem} · {orderToAttend.pedido}</p>
                </div>
              </div>
              <button
                onClick={() => setOrderToAttend(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {getAvailableDestinedQuantity(orderToAttend) <= 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-800">
                  Aguardando a Logística destinar equipamentos. Este pedido não pode iniciar na Produção.
                </div>
              )}
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente / Solicitante:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[200px]">{orderToAttend.clienteSolicitante}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Equipamento:</span>
                  <span className="font-semibold text-slate-800">{orderToAttend.itemModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Falta produzir:</span>
                  <span className="font-bold text-blue-700">{orderToAttend.falta} UN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Já Destinado no Mapeamento:</span>
                  <span className="font-semibold text-emerald-700">{orderToAttend.destinado} UN</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Quantidade a Iniciar Agora</label>
                <input
                  type="number"
                  min="1"
                  max={Math.min(orderToAttend.falta || 100, getAvailableDestinedQuantity(orderToAttend))}
                  value={attendQuantity}
                  onChange={(e) => setAttendQuantity(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Técnico Responsável</label>
                  <input
                    type="text"
                    value={attendTechnician}
                    onChange={(e) => setAttendTechnician(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Bancada / Posto</label>
                  <input
                    type="text"
                    value={attendBench}
                    onChange={(e) => setAttendBench(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Observações de Montagem</label>
                <textarea
                  rows={2}
                  value={attendNotes}
                  onChange={(e) => setAttendNotes(e.target.value)}
                  placeholder="Lote de placas, versão de firmware, observações..."
                  className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                onClick={() => setOrderToAttend(null)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAttend}
                disabled={getAvailableDestinedQuantity(orderToAttend) <= 0}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${getAvailableDestinedQuantity(orderToAttend) <= 0 ? 'cursor-not-allowed bg-slate-300' : 'bg-[#1e3a8a] hover:bg-[#172554]'}`}
              >
                Confirmar e Iniciar Produção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Dialog: Dar Baixa e Finalizar Pedido */}
      <FinalizeBaixaModal
        isOpen={isBaixaModalOpen}
        onClose={() => {
          setIsBaixaModalOpen(false);
          setOrderForBaixa(null);
        }}
        order={orderForBaixa}
        onSuccess={() => {
          // Refresh pending and active orders
          const savedPending = localStorage.getItem('kiraso_pending_ops');
          if (savedPending) {
            try {
              setPendingOrders(JSON.parse(savedPending));
            } catch (e) {
              console.error(e);
            }
          }
          const savedActive = localStorage.getItem('kiraso_active_ops');
          if (savedActive) {
            try {
              setActiveOrders(JSON.parse(savedActive));
            } catch (e) {
              console.error(e);
            }
          }
          setAttendedCount(getAttendedOrders().length);
        }}
      />
    </div>
  );
}
