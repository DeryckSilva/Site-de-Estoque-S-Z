import React, { useState, useMemo } from 'react';
import { BaseOrder } from '../../types/orders';
import { EquipmentItem, OrderItem } from '../../types/mapping';
import { ORDERS_DATABASE } from '../../data/ordersDatabase';
import {
  X,
  Search,
  CheckCircle,
  Package,
  Calendar,
  Building2,
  ArrowRight,
  Filter,
  Sparkles,
} from 'lucide-react';

interface LinkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentItems: EquipmentItem[];
  existingOrders: OrderItem[];
  onSelectOrder: (order: BaseOrder, targetItemId: string) => void;
}

export const LinkOrderModal: React.FC<LinkOrderModalProps> = ({
  isOpen,
  onClose,
  equipmentItems,
  existingOrders,
  onSelectOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('TODOS');
  const [selectedItemOverrides, setSelectedItemOverrides] = useState<Record<string, string>>({});

  // Memoize already linked order numbers for quick lookup
  const linkedOrderNumbers = useMemo(() => {
    return new Set(existingOrders.map((o) => o.numPed.trim().toLowerCase()));
  }, [existingOrders]);

  const filteredOrders = useMemo(() => {
    return ORDERS_DATABASE.filter((ord) => {
      // Filter by type
      if (activeFilter === 'VENDA' && ord.tipoNegocio !== 'VENDA') return false;
      if (activeFilter === 'ASSISTÊNCIA' && ord.tipoNegocio !== 'ASSISTÊNCIA') return false;
      if (activeFilter === 'RECENTES' && !ord.dataSolicitacao.includes('09-2026')) return false;
      if (activeFilter === 'UPGRADE' && !['UPGRADE', 'TESTE', 'TROCA'].includes(ord.tipoNegocio)) return false;

      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        ord.numPedido.toLowerCase().includes(q) ||
        ord.cliente.toLowerCase().includes(q) ||
        (ord.geracao && ord.geracao.toLowerCase().includes(q)) ||
        (ord.modeloVariacao && ord.modeloVariacao.toLowerCase().includes(q)) ||
        (ord.corVariacao && ord.corVariacao.toLowerCase().includes(q)) ||
        (ord.observacao && ord.observacao.toLowerCase().includes(q)) ||
        ord.comercial.toLowerCase().includes(q)
      );
    });
  }, [searchTerm, activeFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Vincular Pedido em Aberto da Base</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                  <Sparkles className="h-3 w-3" /> Auto-Preenchimento
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Selecione o pedido da base ERP para carregar automaticamente o cliente, modelo e alimentar a produção
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-white space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nº do pedido, cliente, modelo (ex: ST8410, 4410G, Santa Cruz, Prima Foods)..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-500 font-medium mr-1">
              <Filter className="h-3.5 w-3.5" /> Filtrar por:
            </span>
            {[
              { id: 'TODOS', label: 'Todos os Pedidos' },
              { id: 'RECENTES', label: 'Setembro / 2026 (Recentes)' },
              { id: 'VENDA', label: 'Vendas' },
              { id: 'ASSISTÊNCIA', label: 'Assistência Técnica' },
              { id: 'UPGRADE', label: 'Upgrade / Testes' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  activeFilter === f.id
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500 font-medium">
              {filteredOrders.length} pedidos encontrados
            </span>
          </div>
        </div>

        {/* Orders List / Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhum pedido encontrado na base</p>
              <p className="text-xs text-slate-500 mt-1">Tente ajustar os termos de busca ou filtros acima.</p>
            </div>
          ) : (
            filteredOrders.map((ord) => {
              const isAlreadyLinked = linkedOrderNumbers.has(ord.numPedido.trim().toLowerCase());
              const targetItemId = selectedItemOverrides[ord.id] || ord.mappedItemId;

              return (
                <div
                  key={ord.id}
                  className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                    isAlreadyLinked
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs'
                  }`}
                >
                  {/* Left Column: Number, Client & Metadata */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        {ord.numPedido}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                          ord.tipoNegocio === 'VENDA'
                            ? 'bg-blue-100 text-blue-800'
                            : ord.tipoNegocio === 'ASSISTÊNCIA'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {ord.tipoNegocio}
                      </span>
                      {isAlreadyLinked && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          <CheckCircle className="h-3 w-3" /> Já Vinculado ao Mapeamento
                        </span>
                      )}
                    </div>

                    {/* Customer */}
                    <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-sm">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{ord.cliente}</span>
                    </div>

                    {/* Specifications */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">
                        {ord.geracao} {ord.modeloVariacao ? `· ${ord.modeloVariacao}` : ''}{' '}
                        {ord.corVariacao ? `· ${ord.corVariacao}` : ''}
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Calendar className="h-3 w-3" /> Solicitação: {ord.dataSolicitacao}
                      </span>
                      {ord.dataEnvio && (
                        <span className="text-slate-500">Envio: {ord.dataEnvio}</span>
                      )}
                    </div>

                    {ord.observacao && (
                      <p className="text-[11px] text-slate-500 italic truncate max-w-xl">
                        Nota: {ord.observacao}
                      </p>
                    )}
                  </div>

                  {/* Right Column: Quantity, Target Item Selector & Action Button */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    {/* Quantity Badge */}
                    <div className="text-center px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
                      <span className="block text-[10px] uppercase font-bold text-slate-500">Qtd</span>
                      <span className="text-base font-bold text-blue-900 font-mono">
                        {ord.quantidade}
                      </span>
                    </div>

                    {/* Mapped Item Selector */}
                    <div className="flex flex-col text-left">
                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Item no Mapeamento
                      </label>
                      <select
                        value={targetItemId}
                        onChange={(e) =>
                          setSelectedItemOverrides((prev) => ({
                            ...prev,
                            [ord.id]: e.target.value,
                          }))
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
                      >
                        {equipmentItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.group})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Link Button */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectOrder(ord, targetItemId);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 active:scale-95 shadow-xs transition-all"
                    >
                      <span>{isAlreadyLinked ? 'Vincular Novamente' : 'Vincular Pedido'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <span>
            Ao vincular, os campos <b>Nº Pedido</b>, <b>Cliente</b>, <b>Quantidade</b> e <b>Item</b> são preenchidos automaticamente e alimentam a produção.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
