import React, { useState } from 'react';
import { OrderItem, EquipmentItem, EquipmentDeliveryEntry } from '../../types/mapping';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Search,
  Package,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { ORDERS_DATABASE, autoDetectEquipmentItem } from '../../data/ordersDatabase';

interface BottomLeftOrdersTableProps {
  orders: OrderItem[];
  equipmentItems: EquipmentItem[];
  deliveries: EquipmentDeliveryEntry[];
  onAddOrder: (order: Omit<OrderItem, 'id'>) => void;
  onUpdateOrder: (id: string, updates: Partial<OrderItem>) => void;
  onDeleteOrder: (id: string) => void;
  onAddDelivery: (cardKey: string, quantidade: number, destinoOuPedido: string, linkedOrderId?: string) => boolean;
  onNavigateToProduction?: () => void;
  onRefreshOrders: () => void;
  isRefreshingOrders: boolean;
}

export const BottomLeftOrdersTable: React.FC<BottomLeftOrdersTableProps> = ({
  orders,
  equipmentItems,
  deliveries,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
  onAddDelivery,
  onNavigateToProduction,
  onRefreshOrders,
  isRefreshingOrders,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [destinationOrderId, setDestinationOrderId] = useState<string | null>(null);
  const [destinationItemId, setDestinationItemId] = useState(equipmentItems[0]?.id || '');
  const [destinationQuantity, setDestinationQuantity] = useState(1);
  const [destinationError, setDestinationError] = useState('');

  // New order form state
  const [newNumPed, setNewNumPed] = useState('');
  const [newCliente, setNewCliente] = useState('');
  const [newQtd, setNewQtd] = useState<number>(1);
  const [newItemId, setNewItemId] = useState<string>(equipmentItems[3]?.id || 'st-8410');
  const [newEntregue, setNewEntregue] = useState(false);
  const [newNotes, setNewNotes] = useState('');

  // Auto-complete suggestion state
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Suggestions from database when typing
  const orderSuggestions = React.useMemo(() => {
    if (!newNumPed.trim() && !newCliente.trim()) return [];
    const qPed = newNumPed.toLowerCase();
    const qCli = newCliente.toLowerCase();
    return ORDERS_DATABASE.filter((o) => {
      return (
        (qPed && o.numPedido.toLowerCase().includes(qPed)) ||
        (qCli && o.cliente.toLowerCase().includes(qCli))
      );
    }).slice(0, 5);
  }, [newNumPed, newCliente]);

  const handleSelectSuggestion = (suggested: BaseOrder) => {
    setNewNumPed(suggested.numPedido);
    setNewCliente(suggested.cliente);
    setNewQtd(suggested.quantidade);
    setNewItemId(suggested.mappedItemId || 'st-8410');
    setNewNotes(suggested.observacao || '');
    setShowSuggestions(false);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumPed.trim()) return;

    onAddOrder({
      numPed: newNumPed.trim(),
      cliente: newCliente.trim() || 'CLIENTE PADRÃO',
      quantidade: Number(newQtd) || 1,
      itemId: newItemId,
      entregueProducao: newEntregue,
      destinadoProducao: newEntregue ? Number(newQtd) || 1 : 0,
      observacao: newNotes,
    });

    setNewNumPed('');
    setNewCliente('');
    setNewQtd(1);
    setNewEntregue(false);
    setNewNotes('');
    setIsAdding(false);
  };

  const deliveriesForOrder = (order: OrderItem) => deliveries.filter((delivery) => delivery.linkedOrderId === order.id || delivery.linkedOrderNumber?.toLowerCase() === order.numPed.toLowerCase());
  const destinedForOrder = (order: OrderItem) => deliveriesForOrder(order).reduce((sum, delivery) => sum + delivery.quantidade, 0);
  const openDestination = (order: OrderItem) => {
    setDestinationOrderId(order.id);
    setDestinationQuantity(Math.max(1, order.quantidade - destinedForOrder(order)));
    setDestinationItemId(order.itemId || equipmentItems[0]?.id || '');
    setDestinationError('');
  };

  const filteredOrders = orders.filter((ord) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const item = equipmentItems.find((i) => i.id === ord.itemId);
    return (
      ord.numPed.toLowerCase().includes(term) ||
      ord.cliente.toLowerCase().includes(term) ||
      (ord.modeloDesc && ord.modeloDesc.toLowerCase().includes(term)) ||
      (item && item.name.toLowerCase().includes(term))
    );
  });

  const totalQtd = orders.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
  const totalEntregue = orders
    .filter((o) => o.entregueProducao)
    .reduce((acc, curr) => acc + (curr.quantidade || 0), 0);

  return (
    <div className="flex flex-col rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden h-full">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-700" />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Comprometidas com Pedido (Inferior Esquerdo)
              </h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded border border-emerald-300">
                Alimenta Produção
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Alimenta automaticamente a coluna "Com pedido" no topo e sincroniza com "Ordens de Produção"
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
            {orders.length} pedidos · {totalQtd} unid. ({totalEntregue} entregues)
          </span>

          <button
            type="button"
            onClick={onRefreshOrders}
            disabled={isRefreshingOrders}
            title="Buscar pedidos atuais da planilha"
            className="inline-flex items-center gap-1 rounded bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingOrders ? 'animate-spin' : ''}`} />
            {isRefreshingOrders ? 'Atualizando...' : 'Atualizar pedidos'}
          </button>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAdding ? 'Fechar' : 'Novo Manual'}
          </button>
        </div>
      </div>

      {/* Quick search input */}
      <div className="border-b border-slate-100 px-3 py-1.5 bg-white">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar pedidos vinculados por nº pedido, cliente ou equipamento..."
            className="w-full rounded border border-slate-200 py-1 pl-8 pr-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Add new order form panel */}
      {isAdding && (
        <form onSubmit={handleAddSubmit} className="border-b border-blue-200 bg-blue-50/60 p-3 text-xs relative">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-blue-900">Novo Registro Manual de Pedido</span>
            <span className="text-[11px] text-blue-700">
              Dica: Digite o número ou cliente para sugestões automáticas da Base
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <div className="relative">
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                Nº Pedido *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 3820-18092026-03"
                value={newNumPed}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setNewNumPed(e.target.value);
                  setShowSuggestions(true);
                }}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 font-mono font-bold text-red-700"
              />

              {/* Autocomplete Dropdown */}
              {showSuggestions && orderSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-md border border-slate-300 shadow-lg max-h-48 overflow-y-auto">
                  <div className="p-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 uppercase border-b">
                    Sugestões da Base de Pedidos
                  </div>
                  {orderSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 border-b border-slate-100 last:border-none flex flex-col"
                    >
                      <span className="font-mono font-bold text-xs text-red-700">{s.numPedido}</span>
                      <span className="text-[11px] text-slate-700 truncate">{s.cliente}</span>
                      <span className="text-[10px] text-slate-500">
                        {s.geracao} · {s.quantidade} unid. ({s.tipoNegocio})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                Cliente *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: ABC CARGAS LTDA"
                value={newCliente}
                onChange={(e) => setNewCliente(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                Quantidade *
              </label>
              <input
                type="number"
                min="1"
                required
                value={newQtd}
                onChange={(e) => setNewQtd(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 font-mono text-center font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                Equipamento / Item *
              </label>
              <select
                value={newItemId}
                onChange={(e) => setNewItemId(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 font-semibold text-slate-800"
              >
                {equipmentItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.group})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none text-xs">
              <input
                type="checkbox"
                checked={newEntregue}
                onChange={(e) => setNewEntregue(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold text-emerald-800">
                Marcar como entregue para produção (Equipamentos Destinados)
              </span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setShowSuggestions(false);
                }}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-800"
              >
                Salvar Pedido
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Orders Table styled like Excel spreadsheet in screenshot */}
      <div className="overflow-x-auto max-h-[480px]">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Nº PED has deep burgundy / dark red header from user spreadsheet */}
              <th className="bg-[#831843] text-white py-1.5 px-2.5 font-bold border-r border-slate-400 text-center w-36 whitespace-nowrap">
                Nº PED
              </th>
              {/* CLIENTE */}
              <th className="bg-[#1e3a8a] text-white py-1.5 px-3 font-bold border-r border-slate-400">
                CLIENTE
              </th>
              {/* QUANTIDADE */}
              <th className="bg-[#1e3a8a] text-white py-1.5 px-2 font-bold border-r border-slate-400 text-center w-20 whitespace-nowrap">
                QUANTIDADE
              </th>
              {/* ITEM */}
              <th className="bg-[#1e3a8a] text-white py-1.5 px-2.5 font-bold border-r border-slate-400 w-36 whitespace-nowrap">
                ITEM NO MAP.
              </th>
              {/* DESTINADO / STATUS PRODUÇÃO */}
              <th className="bg-[#1e3a8a] text-white py-1.5 px-2 font-bold border-r border-slate-400 text-center w-32 whitespace-nowrap">
                DESTINADO PRODUÇÃO
              </th>
              {/* Actions / Status */}
              <th className="bg-[#1e3a8a] text-white py-1.5 px-2 font-bold text-center w-16">
                AÇÕES
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredOrders.map((ord) => {
              const item = equipmentItems.find((i) => i.id === ord.itemId);
              const orderDeliveries = deliveriesForOrder(ord);
              const destinedQty = destinedForOrder(ord) || ord.destinadoProducao || (ord.entregueProducao ? ord.quantidade : 0);
              const isEntregue = destinedQty > 0;
              const remainingQty = Math.max(0, ord.quantidade - destinedQty);
              const isDestinationOpen = destinationOrderId === ord.id;

              return (
                <tr
                  key={ord.id}
                  className={`transition-colors ${
                    isEntregue ? 'bg-[#86efac]/35 hover:bg-[#86efac]/50' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Nº PED with red pill/text */}
                  <td className="py-1 px-2 border-r border-slate-200 font-mono text-[11px] font-bold text-red-700 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={ord.numPed}
                        onChange={(e) => onUpdateOrder(ord.id, { numPed: e.target.value })}
                        className="w-full bg-transparent font-mono font-bold text-red-800 outline-none border-b border-transparent focus:border-red-500 px-0.5"
                      />
                    </div>
                    {ord.tipoNegocio && (
                      <span className="block text-[9px] font-sans font-semibold text-slate-500 uppercase">
                        {ord.tipoNegocio}
                      </span>
                    )}
                  </td>

                  {/* CLIENTE */}
                  <td className="py-1 px-2.5 border-r border-slate-200 font-medium text-slate-800 text-[11px]">
                    <input
                      type="text"
                      value={ord.cliente}
                      onChange={(e) => onUpdateOrder(ord.id, { cliente: e.target.value })}
                      className="w-full bg-transparent text-slate-800 font-semibold outline-none border-b border-transparent focus:border-blue-500 px-0.5"
                    />
                    {ord.modeloDesc && (
                      <span className="block text-[10px] text-slate-500 truncate max-w-[220px]">
                        {ord.modeloDesc}
                      </span>
                    )}
                  </td>

                  {/* QUANTIDADE */}
                  <td className="py-1 px-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                    <input
                      type="number"
                      min="0"
                      value={ord.quantidade}
                      onChange={(e) =>
                        onUpdateOrder(ord.id, {
                          quantidade: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full text-center bg-transparent font-mono font-bold text-slate-900 outline-none border-b border-transparent focus:border-blue-500 py-0.5 text-xs"
                    />
                  </td>

                  {/* ITEM */}
                  <td className="py-1 px-1.5 border-r border-slate-200">
                    <select
                      value={ord.itemId}
                      onChange={(e) => onUpdateOrder(ord.id, { itemId: e.target.value })}
                      className="w-full bg-transparent text-[11px] font-semibold text-slate-800 outline-none border-b border-transparent focus:border-blue-500 cursor-pointer py-0.5"
                    >
                      {equipmentItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* DESTINADO PRODUÇÃO */}
                  <td className="py-1 px-2 border-r border-slate-200 text-center whitespace-nowrap">
                    <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1">
                    {orderDeliveries.length > 0 && <span className="text-[10px] font-semibold text-emerald-700">{orderDeliveries.map((delivery) => `${equipmentItems.find((item) => item.id === delivery.cardKey)?.name || delivery.cardKey}: ${delivery.quantidade}`).join(' + ')}</span>}
                    <button
                      type="button"
                      onClick={() => isDestinationOpen ? setDestinationOrderId(null) : openDestination(ord)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                        isEntregue
                          ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                      title="Adicionar equipamentos destinados pela Logística"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{isEntregue ? `Destinado ${destinedQty}/${ord.quantidade}` : 'Destinar Peças'}</span><ChevronDown className="h-3 w-3" />
                    </button>
                    </div>
                    {isDestinationOpen && <div className="rounded border border-emerald-200 bg-emerald-50 p-1.5 text-left">
                      <div className="flex gap-1">
                        <select value={destinationItemId} onChange={(event) => setDestinationItemId(event.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1 py-1 text-[10px]">{equipmentItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                        <input type="number" min="1" max={Math.max(1, remainingQty)} value={destinationQuantity} onChange={(event) => setDestinationQuantity(Math.max(1, Number(event.target.value) || 1))} className="w-12 rounded border border-slate-300 px-1 py-1 text-center text-[10px]" />
                        <button type="button" onClick={() => { const ok = onAddDelivery(destinationItemId, Math.min(destinationQuantity, remainingQty), ord.numPed, ord.id); if (ok) { setDestinationError(''); setDestinationQuantity(Math.max(1, remainingQty - destinationQuantity)); } else setDestinationError('A soma das peças destinadas não pode passar da quantidade do pedido.'); }} className="rounded bg-emerald-700 px-1.5 py-1 text-[10px] font-bold text-white">Adicionar</button>
                      </div>
                      <p className="mt-1 text-[9px] text-slate-600">Restam {remainingQty} peça(s) para este pedido.</p>
                      {destinationError && <p className="text-[9px] font-semibold text-red-700">{destinationError}</p>}
                    </div>}
                    </div>
                  </td>

                  {/* Status toggle & delete button */}
                  <td className="py-1 px-1 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      {onNavigateToProduction && (
                        <button
                          type="button"
                          title="Ver na fila de Ordens de Produção"
                          onClick={onNavigateToProduction}
                          className="p-1 text-slate-400 hover:text-blue-700 rounded transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        title="Excluir pedido do mapeamento"
                        onClick={() => onDeleteOrder(ord.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer total info */}
      <div className="mt-auto border-t border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <b>Verde:</b> Peças entregues para produção (atualiza OP no painel "A atender")
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-600">
            Total Destinado à Produção: <b className="text-emerald-700">{totalEntregue}</b> / {totalQtd}
          </span>
          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
            Comprometidas c/ Pedido: {totalQtd} unid.
          </span>
        </div>
      </div>
    </div>
  );
};
