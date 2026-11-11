import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, MapPin, Plus, Trash2 } from 'lucide-react';
import { WMS_INITIAL_STOCK } from '../../data/wmsSeed';
import { sharedWmsClient } from '../../services/sharedWmsStore';
import type { InventoryEntry, Unit, WmsData } from '../../types/wms';

const WMS_STORAGE_KEY = 'kiraso_wms_inventory_v2';

type Material = {
  key: string;
  itemCode: string;
  itemName: string;
  unit: Unit;
};

type RequestLine = Material & {
  id: string;
  quantity: number;
};

type StockPosition = {
  location: string;
  lot: string;
  quantity: number;
};

function seedInventory(): InventoryEntry[] {
  return WMS_INITIAL_STOCK.map((row, index) => ({
    id: `base-${index + 1}`,
    location: row.location,
    itemCode: row.sku,
    itemName: row.itemName,
    lot: row.lot,
    boxCount: row.boxCount,
    quantity: row.quantity,
    rawQuantity: row.rawQuantity,
    unit: row.unit,
    status: row.status,
    serialized: false,
    serials: [],
    supplier: '',
    invoiceNumber: '',
    receivedDate: '',
    barcode: row.lot,
  }));
}

function readLocalInventory(): { entries: InventoryEntry[]; error: string } {
  try {
    const saved = localStorage.getItem(WMS_STORAGE_KEY);
    if (!saved) return { entries: seedInventory(), error: '' };

    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Partial<WmsData>).entries)) {
      throw new Error('Formato de estoque local inválido.');
    }
    const entries = (parsed as WmsData).entries;
    if (!entries.every(isInventoryEntry)) throw new Error('O estoque local contém itens inválidos.');
    return { entries, error: '' };
  } catch (error) {
    console.error('Falha ao carregar o estoque para a pré-saída:', error);
    return {
      entries: seedInventory(),
      error: 'Não foi possível ler o estoque salvo. Exibindo a posição inicial do WMS.',
    };
  }
}

function getEntryQuantity(entry: InventoryEntry): number | null {
  if (entry.quantity == null || !Number.isFinite(entry.quantity)) return null;
  return entry.quantity * (entry.boxCount || 1);
}

function formatQuantity(quantity: number, unit: Unit): string {
  return `${quantity.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'MT' ? 3 : 0 })} ${unit}`;
}

function materialKey(itemCode: string, itemName: string, unit: Unit): string {
  return `${itemCode.trim().toLocaleUpperCase('pt-BR')}|${itemName.trim().toLocaleUpperCase('pt-BR')}|${unit}`;
}

function isInventoryEntry(value: unknown): value is InventoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<InventoryEntry>;
  return typeof entry.itemCode === 'string' &&
    typeof entry.itemName === 'string' &&
    typeof entry.location === 'string' &&
    (entry.unit === 'UN' || entry.unit === 'MT') &&
    (entry.quantity === null || (typeof entry.quantity === 'number' && Number.isFinite(entry.quantity)));
}

export function PreExitTab() {
  const [localInventory] = useState(readLocalInventory);
  const [entries, setEntries] = useState<InventoryEntry[]>(localInventory.entries);
  const [inventoryError, setInventoryError] = useState(localInventory.error);
  const [reference, setReference] = useState('');
  const [selectedMaterialKey, setSelectedMaterialKey] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [lines, setLines] = useState<RequestLine[]>([]);

  useEffect(() => {
    const client = sharedWmsClient;
    if (client) {
      let active = true;
      const applySharedData = (data: Partial<WmsData>) => {
        if (!Array.isArray(data.entries) || !data.entries.every(isInventoryEntry)) {
          setInventoryError('O estoque compartilhado retornou dados inválidos.');
          return;
        }
        setEntries(data.entries);
        setInventoryError('');
      };
      const loadSharedInventory = async () => {
        try {
          const { data, error } = await client
            .from('warehouse_state')
            .select('data')
            .eq('id', 1)
            .maybeSingle();
          if (error) throw error;
          if (active && data) applySharedData(data.data as Partial<WmsData>);
        } catch (error) {
          console.error('Falha ao carregar o estoque compartilhado para a pré-saída:', error);
          if (active) setInventoryError('Não foi possível atualizar o estoque compartilhado. Confira a conexão e tente novamente.');
        }
      };

      void loadSharedInventory();
      const channel = client
        .channel('pre-exit-warehouse-state')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'warehouse_state',
          filter: 'id=eq.1',
        }, (payload) => {
          const row = payload.new as { data?: Partial<WmsData> };
          if (row.data) applySharedData(row.data);
        })
        .subscribe();

      return () => {
        active = false;
        void client.removeChannel(channel);
      };
    }

    const refreshLocalInventory = () => {
      const next = readLocalInventory();
      setEntries(next.entries);
      setInventoryError(next.error);
    };
    window.addEventListener('storage', refreshLocalInventory);
    window.addEventListener('kiraso_wms_inventory_sync', refreshLocalInventory);
    return () => {
      window.removeEventListener('storage', refreshLocalInventory);
      window.removeEventListener('kiraso_wms_inventory_sync', refreshLocalInventory);
    };
  }, []);

  const materials = useMemo(() => {
    const grouped = new Map<string, Material>();
    entries.forEach((entry) => {
      const key = materialKey(entry.itemCode, entry.itemName, entry.unit);
      if (!grouped.has(key)) {
        grouped.set(key, { key, itemCode: entry.itemCode, itemName: entry.itemName, unit: entry.unit });
      }
    });
    return [...grouped.values()].sort((a, b) =>
      a.itemName.localeCompare(b.itemName, 'pt-BR', { sensitivity: 'base' })
    );
  }, [entries]);

  const selectedMaterial = materials.find((material) => material.key === selectedMaterialKey);

  const stockByMaterial = useMemo(() => {
    const stock = new Map<string, StockPosition[]>();
    entries.filter((entry) => entry.status === 'ARMAZENADO').forEach((entry) => {
      const quantity = getEntryQuantity(entry);
      if (quantity == null || quantity <= 0) return;
      const key = materialKey(entry.itemCode, entry.itemName, entry.unit);
      const positions = stock.get(key) ?? [];
      positions.push({ location: entry.location || 'SEM POSIÇÃO', lot: entry.lot || '—', quantity });
      stock.set(key, positions);
    });
    stock.forEach((positions) => positions.sort((a, b) =>
      a.location.localeCompare(b.location, 'pt-BR') || a.lot.localeCompare(b.lot, 'pt-BR')
    ));
    return stock;
  }, [entries]);

  const addLine = () => {
    if (!selectedMaterial) return;
    const quantity = Number(quantityInput.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0 || (selectedMaterial.unit === 'UN' && !Number.isInteger(quantity))) return;

    setLines((current) => {
      const existing = current.find((line) => line.key === selectedMaterial.key);
      if (existing) {
        return current.map((line) => line.key === selectedMaterial.key
          ? { ...line, quantity: line.quantity + quantity }
          : line);
      }
      return [...current, { ...selectedMaterial, id: crypto.randomUUID(), quantity }];
    });
    setSelectedMaterialKey('');
    setQuantityInput('1');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pré-saída de materiais</h1>
            <p className="text-xs text-gray-500">Informe os itens e veja de quais posições separar, sem movimentar o estoque.</p>
          </div>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">
          Apenas planejamento · não realiza baixa
        </span>
      </div>

      {inventoryError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{inventoryError}</span>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(240px,2fr)_120px_auto] sm:items-end">
          <label className="space-y-1.5 text-xs font-medium text-slate-700">
            OP / Referência
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Ex.: OP-1234"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-slate-700">
            Matéria-prima
            <select
              value={selectedMaterialKey}
              onChange={(event) => setSelectedMaterialKey(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Selecione o material…</option>
              {materials.map((material) => (
                <option key={material.key} value={material.key}>
                  {material.itemCode} · {material.itemName} ({material.unit})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-slate-700">
            Quantidade
            <input
              type="number"
              min="0"
              step={selectedMaterial?.unit === 'MT' ? '0.001' : '1'}
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            onClick={addLine}
            disabled={!selectedMaterial || Number(quantityInput.replace(',', '.')) <= 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        {selectedMaterial?.unit === 'UN' && Number(quantityInput.replace(',', '.')) % 1 !== 0 && (
          <p className="mt-2 text-xs text-red-600">Informe uma quantidade inteira para itens em unidades.</p>
        )}
      </section>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white/70 px-4 py-12 text-center">
          <MapPin className="mx-auto h-8 w-8 text-gray-400" />
          <h2 className="mt-3 text-sm font-semibold text-slate-800">Monte sua lista de separação</h2>
          <p className="mt-1 text-xs text-gray-500">Adicione matérias-primas para visualizar as posições e os saldos disponíveis.</p>
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Separação prevista</h2>
              <p className="text-xs text-gray-500">
                {reference.trim() ? `Referência: ${reference.trim()} · ` : ''}
                {lines.length} {lines.length === 1 ? 'material' : 'materiais'}
              </p>
            </div>
            <button type="button" onClick={() => setLines([])} className="text-xs font-medium text-gray-500 hover:text-red-600">
              Limpar lista
            </button>
          </div>

          {lines.map((line) => {
            const positions = stockByMaterial.get(line.key) ?? [];
            const totalAvailable = positions.reduce((total, position) => total + position.quantity, 0);
            let remaining = line.quantity;
            const picks = positions.map((position) => {
              const picked = Math.min(remaining, position.quantity);
              remaining -= picked;
              return { ...position, picked };
            }).filter((position) => position.picked > 0);
            const shortage = Math.max(0, line.quantity - totalAvailable);

            return (
              <article key={line.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{line.itemCode}</p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900">{line.itemName}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Solicitação: <strong className="text-slate-800">{formatQuantity(line.quantity, line.unit)}</strong>
                      <span className="mx-2 text-gray-300">·</span>
                      Disponível: <strong className="text-slate-800">{formatQuantity(totalAvailable, line.unit)}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                    aria-label={`Remover ${line.itemName}`}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4">
                  {picks.length > 0 ? (
                    <>
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                        <MapPin className="h-3.5 w-3.5" /> Posições sugeridas para coleta
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[480px] text-left text-xs">
                          <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="py-2 pr-3 font-medium">Localização</th>
                              <th className="py-2 pr-3 font-medium">Lote</th>
                              <th className="py-2 pr-3 text-right font-medium">Saldo no local</th>
                              <th className="py-2 text-right font-medium">Separar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {picks.map((position, index) => (
                              <tr key={`${position.location}-${position.lot}-${index}`} className="border-t border-gray-100">
                                <td className="py-2.5 pr-3 font-semibold text-slate-800">{position.location}</td>
                                <td className="py-2.5 pr-3 text-gray-500">{position.lot}</td>
                                <td className="py-2.5 pr-3 text-right text-gray-600">{formatQuantity(position.quantity, line.unit)}</td>
                                <td className="py-2.5 text-right font-bold text-emerald-700">{formatQuantity(position.picked, line.unit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-red-600">Nenhuma posição com saldo disponível para este material.</p>
                  )}
                  {shortage > 0 && (
                    <p className="mt-3 flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Faltam {formatQuantity(shortage, line.unit)} para completar a separação.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
