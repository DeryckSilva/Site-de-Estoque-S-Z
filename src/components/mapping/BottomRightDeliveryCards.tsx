import React, { useState } from 'react';
import { EquipmentItem, SemPedidoEntry, EquipmentDeliveryEntry, OrderItem } from '../../types/mapping';
import { Plus, Trash2, Layers, AlertCircle } from 'lucide-react';

interface BottomRightDeliveryCardsProps {
  equipmentItems: EquipmentItem[];
  orders: OrderItem[];
  semPedidoEntries: SemPedidoEntry[];
  deliveries: EquipmentDeliveryEntry[];
  onAddSemPedido: (entry: Omit<SemPedidoEntry, 'id'>) => void;
  onUpdateSemPedido: (id: string, updates: Partial<SemPedidoEntry>) => void;
  onDeleteSemPedido: (id: string) => void;
  onAddDelivery: (cardKey: string, quantidade: number, destinoOuPedido: string, linkedOrderId?: string) => boolean;
  onUpdateDelivery: (id: string, updates: Partial<EquipmentDeliveryEntry>) => void;
  onDeleteDelivery: (id: string) => void;
}

export const BottomRightDeliveryCards: React.FC<BottomRightDeliveryCardsProps> = ({
  equipmentItems,
  orders,
  semPedidoEntries,
  deliveries,
  onAddSemPedido,
  onUpdateSemPedido,
  onDeleteSemPedido,
  onAddDelivery,
  onUpdateDelivery,
  onDeleteDelivery,
}) => {
  // Local state for quickly adding lines in any card
  const [activeAddCard, setActiveAddCard] = useState<string | null>(null);
  const [newCardQtd, setNewCardQtd] = useState<number>(1);
  const [newCardDestino, setNewCardDestino] = useState<string>('');
  const [newCardOrderId, setNewCardOrderId] = useState<string>('');
  const [addError, setAddError] = useState('');
  const deliveryCards = [
    ...equipmentItems.map((item) => ({ key: item.id, title: item.name })),
    { key: 'sem-pedido', title: 'Sem pedido', isSemPedidoSpecial: true },
    { key: 'com-a-producao', title: 'Com a Produção' },
  ];
  const [newSemPedidoItemId, setNewSemPedidoItemId] = useState<string>(equipmentItems[8]?.id || 'tag-card');

  const handleQuickAdd = (cardKey: string, isSemPedido = false) => {
    if (isSemPedido) {
      onAddSemPedido({
        quantidade: Math.max(1, newCardQtd),
        itemId: newSemPedidoItemId,
        destino: newCardDestino.trim() || 'Produção',
      });
    } else {
      if (!newCardDestino.trim()) return;
      const added = onAddDelivery(cardKey, Math.max(1, newCardQtd), newCardDestino.trim(), newCardOrderId || undefined);
      if (!added) {
        setAddError('A quantidade ultrapassa o total ainda necessário para este pedido.');
        return;
      }
    }

    setNewCardQtd(1);
    setNewCardDestino('');
    setNewCardOrderId('');
    setAddError('');
    setActiveAddCard(null);
  };

  return (
    <div className="flex flex-col rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden h-full">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-700" />
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Equipamentos Entregues para Produção (Inferior Direito)
            </h3>
            <p className="text-[11px] text-slate-500">
              Preencha aqui o que foi entregue. A caixa "Sem pedido" alimenta "Comprometidas Sem Pedido" na tabela superior.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Excel Mini-Tables / Cards */}
      <div className="p-3 overflow-y-auto max-h-[580px] bg-slate-100/50">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {deliveryCards.map((card) => {
            const isSemPedido = !!card.isSemPedidoSpecial;
            const isAddingThis = activeAddCard === card.key;

            if (isSemPedido) {
              // SPECIAL CARD: "Sem pedido"
              const totalSemPed = semPedidoEntries.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);

              return (
                <div
                  key={card.key}
                  className="rounded border-2 border-purple-400 bg-white shadow-sm overflow-hidden flex flex-col"
                >
                  {/* Header */}
                  <div className="bg-[#1e293b] text-white px-2.5 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-purple-300 tracking-wide uppercase">
                        {card.title}
                      </span>
                      <span className="text-[10px] bg-purple-950/80 text-purple-200 px-1.5 py-0.2 rounded border border-purple-600">
                        Alimenta Tabela Superior
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-300">
                      Total: {totalSemPed}
                    </span>
                  </div>

                  {/* Table rows */}
                  <div className="p-1 flex-1 overflow-x-auto min-h-[90px]">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                          <th className="py-0.5 px-1 text-center w-12">Qtd</th>
                          <th className="py-0.5 px-1 text-left">Item</th>
                          <th className="py-0.5 px-1 text-left">Obs / Destino</th>
                          <th className="py-0.5 px-0.5 w-6"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {semPedidoEntries.map((sp) => {
                          const item = equipmentItems.find((i) => i.id === sp.itemId);
                          return (
                            <tr key={sp.id} className="hover:bg-purple-50/50">
                              <td className="py-0.5 px-1 text-center font-mono font-bold text-purple-900 border-r border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  value={sp.quantidade}
                                  onChange={(e) =>
                                    onUpdateSemPedido(sp.id, {
                                      quantidade: Math.max(0, parseInt(e.target.value) || 0),
                                    })
                                  }
                                  className="w-full text-center bg-transparent font-mono font-bold text-purple-900 outline-none border-b border-transparent focus:border-purple-500"
                                />
                              </td>
                              <td className="py-0.5 px-1 text-slate-800 border-r border-slate-100 font-medium">
                                <select
                                  value={sp.itemId}
                                  onChange={(e) => onUpdateSemPedido(sp.id, { itemId: e.target.value })}
                                  className="w-full bg-transparent text-[11px] outline-none cursor-pointer"
                                >
                                  {equipmentItems.map((eq) => (
                                    <option key={eq.id} value={eq.id}>
                                      {eq.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-0.5 px-1 text-slate-600 border-r border-slate-100">
                                <input
                                  type="text"
                                  value={sp.destino}
                                  onChange={(e) => onUpdateSemPedido(sp.id, { destino: e.target.value })}
                                  className="w-full bg-transparent outline-none text-[11px]"
                                />
                              </td>
                              <td className="py-0.5 px-0.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => onDeleteSemPedido(sp.id)}
                                  className="text-slate-300 hover:text-red-600 p-0.5"
                                  title="Remover"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {semPedidoEntries.length === 0 && (
                      <div className="text-center py-3 text-[11px] text-slate-400">
                        Nenhum item sem pedido cadastrado.
                      </div>
                    )}
                  </div>

                  {/* Add Row Section */}
                  {isAddingThis ? (
                    <div className="border-t border-purple-200 bg-purple-50 p-2 text-xs space-y-1.5">
                      <div className="font-semibold text-purple-900 text-[11px]">Adicionar Sem Pedido</div>
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-500">Qtd</label>
                          <input
                            type="number"
                            min="1"
                            value={newCardQtd}
                            onChange={(e) => setNewCardQtd(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] uppercase font-bold text-slate-500">Item</label>
                          <select
                            value={newSemPedidoItemId}
                            onChange={(e) => setNewSemPedidoItemId(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-xs"
                          >
                            {equipmentItems.map((eq) => (
                              <option key={eq.id} value={eq.id}>
                                {eq.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-slate-500">Observação / Destino</label>
                        <input
                          type="text"
                          placeholder="Ex: Santa Cruz, Victor cx 3D"
                          value={newCardDestino}
                          onChange={(e) => setNewCardDestino(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveAddCard(null)}
                          className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(card.key, true)}
                          className="text-[11px] bg-purple-700 text-white font-medium px-2.5 py-0.5 rounded hover:bg-purple-800"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAddCard(card.key);
                        setNewCardQtd(1);
                        setNewCardDestino('');
                      }}
                      className="border-t border-slate-200 text-[11px] font-medium text-purple-700 bg-purple-50/40 hover:bg-purple-100/70 py-1 px-2 flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar item sem pedido
                    </button>
                  )}
                </div>
              );
            }

            // STANDARD EQUIPMENT DELIVERY CARDS
            const cardDeliveries = deliveries.filter((d) => d.cardKey === card.key);
            const totalQtd = cardDeliveries.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);

            return (
              <div
                key={card.key}
                className="rounded border border-slate-300 bg-white shadow-sm overflow-hidden flex flex-col hover:border-slate-400 transition-colors"
              >
                {/* Header */}
                <div className="bg-[#0f2942] text-white px-2.5 py-1.5 flex items-center justify-between">
                  <span className="font-bold text-xs tracking-wide">{card.title}</span>
                  <span className="font-mono text-xs font-bold bg-[#1e456e] px-1.5 py-0.2 rounded text-blue-100">
                    {totalQtd > 0 ? totalQtd : '—'}
                  </span>
                </div>

                {/* Table rows */}
                <div className="p-1 flex-1 overflow-x-auto min-h-[75px]">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                        <th className="py-0.5 px-1 text-center w-12">Qtd</th>
                        <th className="py-0.5 px-1 text-left">Pedido / Destino</th>
                        <th className="py-0.5 px-0.5 w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cardDeliveries.map((del) => (
                        <tr key={del.id} className="hover:bg-slate-50">
                          <td className="py-0.5 px-1 text-center font-mono font-bold text-slate-800 border-r border-slate-100">
                            <input
                              type="number"
                              min="0"
                              value={del.quantidade}
                              onChange={(e) =>
                                onUpdateDelivery(del.id, {
                                  quantidade: Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              className="w-full text-center bg-transparent font-mono font-bold text-slate-800 outline-none border-b border-transparent focus:border-blue-500"
                            />
                          </td>
                          <td className="py-0.5 px-1 text-slate-700 font-medium border-r border-slate-100">
                            <input
                              type="text"
                              value={del.destinoOuPedido}
                              onChange={(e) =>
                                onUpdateDelivery(del.id, { destinoOuPedido: e.target.value })
                              }
                              className="w-full bg-transparent outline-none text-[11px]"
                            />
                            {del.linkedOrderNumber && <span className="block text-[9px] font-semibold text-blue-700">Pedido: {del.linkedOrderNumber}</span>}
                          </td>
                          <td className="py-0.5 px-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => onDeleteDelivery(del.id)}
                              className="text-slate-300 hover:text-red-600 p-0.5"
                              title="Remover"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {cardDeliveries.length === 0 && (
                    <div className="text-center py-2 text-[10px] text-slate-300">
                      Nenhuma entrega lançada.
                    </div>
                  )}
                </div>

                {/* Add Row Section */}
                {isAddingThis ? (
                  <div className="border-t border-blue-200 bg-blue-50/70 p-2 text-xs space-y-1.5">
                    <div className="font-semibold text-blue-900 text-[11px]">Nova Entrega</div>
                    <div className="flex gap-1">
                      <div className="w-16 shrink-0">
                        <label className="text-[9px] uppercase font-bold text-slate-500">Qtd</label>
                        <input
                          type="number"
                          min="1"
                          value={newCardQtd}
                          onChange={(e) => setNewCardQtd(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] uppercase font-bold text-slate-500">Pedido / Destino</label>
                        <input
                          type="text"
                          placeholder="Ex: Alvoar, 3813..."
                          value={newCardDestino}
                          onChange={(e) => setNewCardDestino(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500">Vincular ao pedido</label>
                      <select value={newCardOrderId} onChange={(e) => setNewCardOrderId(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs">
                        <option value="">Sem pedido / destino avulso</option>
                        {orders.map((order) => <option key={order.id} value={order.id}>{order.numPed} · {order.cliente} · {order.quantidade} un.</option>)}
                      </select>
                    </div>
                    {addError && <p className="text-[10px] font-semibold text-red-700">{addError}</p>}
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveAddCard(null)}
                        className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(card.key, false)}
                        className="text-[11px] bg-blue-700 text-white font-medium px-2.5 py-0.5 rounded hover:bg-blue-800"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAddCard(card.key);
                      setNewCardQtd(1);
                      setNewCardDestino('');
                      setNewCardOrderId('');
                      setAddError('');
                    }}
                    className="border-t border-slate-100 text-[11px] text-slate-500 hover:text-blue-700 hover:bg-slate-50 py-1 px-2 flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Lançar entrega
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
