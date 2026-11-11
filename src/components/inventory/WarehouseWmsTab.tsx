import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowLeftRight, Barcode, Boxes, ClipboardMinus, Factory, Maximize2, MapPin, MapPinned, Minimize2, PackagePlus, Search } from 'lucide-react';
import { WMS_INITIAL_STOCK } from '../../data/wmsSeed';
import { INITIAL_IN_PROGRESS_ORDERS, INITIAL_PRODUCTION_ORDERS } from '../../data/productionOrdersData';
import type { ProductionOrder } from '../../types/production';
import type { InventoryEntry, MovementKind, StockMovement, Unit, WmsData } from '../../types/wms';
import { DEFAULT_WAREHOUSE_LAYOUT } from '../../types/wms';
import { sharedWmsClient } from '../../services/sharedWmsStore';

const WarehouseThreeMap = lazy(() => import('./WarehouseThreeMap').then((module) => ({
  default: module.WarehouseThreeMap,
})));

const STORAGE_KEY = 'kiraso_wms_inventory_v2';
const SEED_VERSION_KEY = 'kiraso_wms_inventory_seed_version';
const SEED_VERSION = 'mapped-stock-v1';
const LEGACY_STORAGE_KEY = 'kiraso_wms_plps_v1';
const EMPTY_DATA: WmsData = { entries: [], movements: [], layout: DEFAULT_WAREHOUSE_LAYOUT };

function createSeedEntries(): InventoryEntry[] {
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

function normalizeData(value: Partial<WmsData>): WmsData {
  return {
    entries: (value.entries ?? []).map((entry) => ({
      ...entry,
      boxCount: entry.boxCount ?? 0,
      quantity: entry.quantity ?? null,
      rawQuantity: entry.rawQuantity ?? String(entry.quantity ?? ''),
      unit: entry.unit ?? 'UN',
      status: entry.status ?? 'ARMAZENADO',
      serialized: entry.serialized ?? false,
      serials: entry.serials ?? [],
      supplier: entry.supplier ?? '',
      invoiceNumber: entry.invoiceNumber ?? '',
      receivedDate: entry.receivedDate ?? '',
      barcode: entry.barcode ?? '',
    })),
    movements: (value.movements ?? []).map((movement) => ({
      ...movement,
      kind: movement.kind ?? 'baixa',
      locationFrom: movement.locationFrom ?? movement.location ?? '',
      locationTo: movement.locationTo ?? '',
      reference: movement.reference ?? '',
      unit: movement.unit ?? 'UN',
      serials: movement.serials ?? [],
      wallBarcode: movement.wallBarcode ?? '',
      productionOrderCode: movement.productionOrderCode ?? '',
    })),
    layout: value.layout ?? DEFAULT_WAREHOUSE_LAYOUT,
    pickupSignatures: value.pickupSignatures ?? [],
  };
}

function readData(): WmsData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const savedData = normalizeData(JSON.parse(saved) as Partial<WmsData>);
      if (localStorage.getItem(SEED_VERSION_KEY) !== SEED_VERSION) {
        const userEntries = savedData.entries.filter((entry) => !entry.id.startsWith('base-'));
        const updatedData = { ...savedData, entries: [...createSeedEntries(), ...userEntries] };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
        localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
        return updatedData;
      }
      return savedData;
    }

    const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
    const legacy = legacySaved ? JSON.parse(legacySaved) as {
      plps?: Array<{ id: string; barcode: string; boxes?: Array<{
        id: string; barcode?: string; itemCode: string; itemName: string; quantity: number;
        serials?: string[]; serialized?: boolean; supplier?: string; invoiceNumber?: string;
        receivedDate?: string; location?: string;
      }> }>;
      movements?: Array<{ id: string; date: string; plpBarcode: string; boxBarcode?: string;
        itemName: string; quantity: number; serials?: string[] }>;
    } : null;
    const legacyData = legacy ? normalizeData({
      entries: (legacy.plps ?? []).flatMap((plp) => (plp.boxes ?? []).map((box) => ({
        id: box.id,
        location: box.location || 'SEM POSIÇÃO',
        itemCode: box.itemCode,
        itemName: box.itemName,
        lot: plp.barcode,
        boxCount: box.quantity > 0 ? 1 : 0,
        quantity: box.quantity,
        rawQuantity: String(box.quantity),
        unit: 'UN' as const,
        status: box.quantity > 0 ? 'ARMAZENADO' : 'BAIXADO',
        serialized: box.serialized ?? false,
        serials: box.serials ?? [],
        supplier: box.supplier ?? '',
        invoiceNumber: box.invoiceNumber ?? '',
        receivedDate: box.receivedDate ?? '',
        barcode: box.barcode ?? '',
      }))),
      movements: (legacy.movements ?? []).map((movement) => ({
        id: movement.id, date: movement.date, kind: 'baixa' as const, itemCode: '',
        itemName: movement.itemName, lot: movement.plpBarcode,
        locationFrom: '', locationTo: '', quantity: movement.quantity, unit: 'UN' as const,
        reference: 'Baixa anterior', serials: movement.serials ?? [], wallBarcode: '', productionOrderCode: '',
      })),
    }) : EMPTY_DATA;

    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
    return {
      entries: [...createSeedEntries(), ...legacyData.entries],
      movements: legacyData.movements,
      layout: DEFAULT_WAREHOUSE_LAYOUT,
    };
  } catch {
    return { entries: createSeedEntries(), movements: [] };
  }
}

function parseSerials(value: string) {
  return value.split(/[\n,;]+/).map((serial) => serial.trim()).filter(Boolean);
}

function formatQuantity(value: number, unit: Unit) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'MT' ? 3 : 0 })} ${unit}`;
}

function getBoxAdjustedQuantity(entry: InventoryEntry) {
  return (entry.quantity ?? 0) * (entry.boxCount || 1);
}

function isValidQuantity(value: number, unit: Unit) {
  return Number.isFinite(value) && value > 0 && (unit === 'MT' || Number.isInteger(value));
}

function normalizeBarcode(value: string) {
  return value.trim().replace(/\s+/g, '').toLocaleUpperCase('pt-BR');
}

function readProductionOrders(): ProductionOrder[] {
  try {
    const pending = localStorage.getItem('kiraso_pending_ops');
    const active = localStorage.getItem('kiraso_active_ops');
    const pendingOrders = pending ? JSON.parse(pending) as ProductionOrder[] : [];
    const activeOrders = active ? JSON.parse(active) as ProductionOrder[] : [];
    const allOrders = [...INITIAL_PRODUCTION_ORDERS, ...INITIAL_IN_PROGRESS_ORDERS, ...pendingOrders, ...activeOrders];
    const uniqueOrders = new Map<string, ProductionOrder>();
    allOrders.forEach((order) => {
      const key = normalizeBarcode(order.ordem || order.pedido || order.id);
      if (key) uniqueOrders.set(key, order);
    });
    return [...uniqueOrders.values()];
  } catch {
    return [...INITIAL_PRODUCTION_ORDERS, ...INITIAL_IN_PROGRESS_ORDERS];
  }
}

function ProductionIssuePanel({ data, onSave }: { data: WmsData; onSave: (next: WmsData, message?: string) => void }) {
  const [lpnBarcode, setLpnBarcode] = useState('');
  const [wallBarcode, setWallBarcode] = useState('');
  const [entryId, setEntryId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [serialInput, setSerialInput] = useState('');
  const [notice, setNotice] = useState('');
  const lpnInputRef = useRef<HTMLInputElement>(null);
  const wallInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const lastLookedUpLpn = useRef('');

  const lpnMatches = useMemo(() => {
    const scanned = normalizeBarcode(lpnBarcode);
    if (!scanned) return [];
    return data.entries.filter((entry) =>
      normalizeBarcode(entry.lot) === scanned || normalizeBarcode(entry.barcode) === scanned,
    );
  }, [data.entries, lpnBarcode]);
  const lpnStatus = useMemo(() => {
    if (!lpnMatches.length) return null;
    const pendingCount = lpnMatches.filter((entry) => entry.quantity == null).length;
    const availableEntries = lpnMatches.filter((entry) => entry.quantity != null && entry.quantity > 0);
    const totalUnits = lpnMatches.reduce((total, entry) => total + (entry.unit === 'UN' ? entry.quantity ?? 0 : 0), 0);
    const totalMeters = lpnMatches.reduce((total, entry) => total + (entry.unit === 'MT' ? entry.quantity ?? 0 : 0), 0);
    const status = pendingCount
      ? availableEntries.length ? 'PARCIAL · CONFERÊNCIA PENDENTE' : 'PENDENTE DE CONFERÊNCIA'
      : availableEntries.length ? 'ARMAZENADO' : 'BAIXADO';
    return { status, pendingCount, availableEntries, totalUnits, totalMeters };
  }, [lpnMatches]);
  const selectedEntry = lpnMatches.find((entry) => entry.id === entryId);
  const productionOrders = useMemo(readProductionOrders, [wallBarcode]);
  const normalizedWallCode = normalizeBarcode(wallBarcode);
  const linkedOrder = productionOrders.find((order) => [order.ordem, order.pedido, order.id]
    .some((code) => normalizeBarcode(code) === normalizedWallCode));

  const lookupLpn = (value: string) => {
    const scanned = value.trim();
    const normalized = normalizeBarcode(scanned);
    if (!normalized || normalized === lastLookedUpLpn.current) return;
    lastLookedUpLpn.current = normalized;
    const matches = data.entries.filter((entry) =>
      normalizeBarcode(entry.lot) === normalized || normalizeBarcode(entry.barcode) === normalized,
    );
    setLpnBarcode(scanned);
    setEntryId(matches.length === 1 ? matches[0].id : '');
    setQuantity('1');
    setSerialInput('');
    if (matches.length === 0) setNotice(`LPN ${scanned} não encontrada no WMS.`);
    else if (matches.length === 1 && matches[0].quantity == null) setNotice('LPN encontrada, mas a quantidade dessa linha precisa ser conferida no estoque.');
    else if (matches.length === 1) setNotice(`LPN encontrada: ${matches[0].itemName} · ${matches[0].quantity} ${matches[0].unit} em ${matches[0].location}.`);
    else setNotice(`LPN encontrada em ${matches.length} linhas. Selecione a posição/lote correto.`);
    if (matches.length > 0) wallInputRef.current?.focus();
  };

  useEffect(() => {
    const scanned = lpnBarcode.trim();
    const normalized = normalizeBarcode(scanned);
    if (!normalized || normalized === lastLookedUpLpn.current) return;
    const timeoutId = window.setTimeout(() => lookupLpn(scanned), 250);
    return () => window.clearTimeout(timeoutId);
  }, [lpnBarcode, data.entries]);

  const registerOutput = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lpnBarcode.trim() || !wallBarcode.trim()) {
      setNotice('Bipe a LPN e o código da parede antes de confirmar a saída.');
      return;
    }
    if (!selectedEntry || selectedEntry.quantity == null || selectedEntry.quantity <= 0) {
      setNotice('Selecione uma linha da LPN com saldo conferido e disponível.');
      return;
    }
    const serials = selectedEntry.serialized ? parseSerials(serialInput) : [];
    const issueQuantity = selectedEntry.serialized ? serials.length : Number(quantity);
    if (!isValidQuantity(issueQuantity, selectedEntry.unit) || issueQuantity > selectedEntry.quantity) {
      setNotice(`Saldo disponível nessa posição: ${formatQuantity(selectedEntry.quantity, selectedEntry.unit)}.`);
      return;
    }
    if (selectedEntry.serialized && (
      new Set(serials).size !== serials.length || serials.some((serial) => !selectedEntry.serials.includes(serial))
    )) {
      setNotice('Use somente seriais disponíveis nessa LPN, sem repetição.');
      return;
    }

    const remaining = selectedEntry.quantity - issueQuantity;
    const entries = data.entries.map((entry) => entry.id !== selectedEntry.id ? entry : {
      ...entry,
      quantity: remaining,
      rawQuantity: String(remaining),
      boxCount: remaining === 0 ? 0 : entry.boxCount,
      serials: entry.serials.filter((serial) => !serials.includes(serial)),
      status: remaining === 0 ? 'BAIXADO' : entry.status,
    });
    const movement: StockMovement = {
      id: crypto.randomUUID(), date: new Date().toISOString(), kind: 'saida_producao',
      itemCode: selectedEntry.itemCode, itemName: selectedEntry.itemName, lot: selectedEntry.lot,
      locationFrom: selectedEntry.location, locationTo: 'PRODUÇÃO', quantity: issueQuantity,
      unit: selectedEntry.unit, reference: linkedOrder?.ordem || `Parede ${wallBarcode.trim()}`,
      serials, wallBarcode: wallBarcode.trim(), productionOrderCode: linkedOrder?.ordem ?? '',
    };
    onSave({ entries, movements: [movement, ...data.movements] }, 'Saída da produção registrada no WMS.');
    setNotice(`${formatQuantity(issueQuantity, selectedEntry.unit)} baixado(s) da LPN ${selectedEntry.lot}${linkedOrder ? ` para ${linkedOrder.ordem}` : ''}.`);
    setQuantity('1');
    setSerialInput('');
    setEntryId('');
    setWallBarcode('');
    setLpnBarcode('');
    lastLookedUpLpn.current = '';
    window.setTimeout(() => lpnInputRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3"><Factory className="h-5 w-5 text-emerald-700" /><div><h2 className="text-base font-semibold text-slate-900">Saída de materiais para produção</h2><p className="text-xs text-gray-500">A baixa será feita no saldo do WMS e ficará vinculada ao código lido na parede.</p></div></div>
      <form onSubmit={registerOutput} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2"><Barcode className="h-4 w-4 text-blue-700" /><h3 className="text-sm font-semibold text-slate-900">1. LPN do estoque</h3></div>
          <label className="block text-xs font-medium text-gray-600">Bipe o código de barras da LPN
            <input ref={lpnInputRef} autoFocus value={lpnBarcode} onChange={(event) => setLpnBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); lookupLpn(event.currentTarget.value); } }} placeholder="A leitura do bipador aparece aqui" className="mt-1 w-full rounded border border-gray-300 px-3 py-2.5 font-mono text-base" />
          </label>
          {lpnStatus && <div role="status" className={`rounded border p-3 ${lpnStatus.pendingCount ? 'border-amber-200 bg-amber-50' : lpnStatus.availableEntries.length ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-gray-600">Status da LPN</span><span className={`text-xs font-bold ${lpnStatus.pendingCount ? 'text-amber-800' : lpnStatus.availableEntries.length ? 'text-emerald-800' : 'text-gray-600'}`}>{lpnStatus.status}</span></div><div className="mt-1 text-sm font-semibold text-slate-900">{lpnStatus.totalUnits > 0 ? formatQuantity(lpnStatus.totalUnits, 'UN') : ''}{lpnStatus.totalUnits > 0 && lpnStatus.totalMeters > 0 ? ' · ' : ''}{lpnStatus.totalMeters > 0 ? formatQuantity(lpnStatus.totalMeters, 'MT') : ''}{lpnStatus.totalUnits === 0 && lpnStatus.totalMeters === 0 ? 'Sem saldo conferido' : ' disponíveis'}</div><div className="mt-1 text-xs text-gray-600">{lpnMatches.length} registro(s) · {new Set(lpnMatches.map((entry) => entry.location)).size} posição(ões){lpnStatus.pendingCount ? ` · ${lpnStatus.pendingCount} quantidade(s) pendente(s)` : ''}</div></div>}
          {lpnMatches.length > 1 && <label className="block text-xs font-medium text-gray-600">Escolha o saldo de origem
            <select required value={entryId} onChange={(event) => setEntryId(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm"><option value="">Selecione posição e saldo</option>{lpnMatches.map((entry) => <option key={entry.id} value={entry.id}>{entry.location} · SKU {entry.itemCode} · {entry.quantity == null ? `Conferir ${entry.rawQuantity}` : formatQuantity(entry.quantity, entry.unit)}</option>)}</select>
          </label>}
          {selectedEntry && <div className={`rounded border p-3 text-sm ${selectedEntry.quantity == null ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><div className="font-semibold text-slate-900">{selectedEntry.itemName} · SKU {selectedEntry.itemCode}</div><div className="mt-1 text-xs text-slate-700">Lote {selectedEntry.lot} · posição {selectedEntry.location}</div><div className="mt-1 font-semibold text-slate-800">{selectedEntry.quantity == null ? `Quantidade a conferir: ${selectedEntry.rawQuantity}` : `Disponível: ${formatQuantity(selectedEntry.quantity, selectedEntry.unit)}`}</div>{selectedEntry.quantity == null && <div className="mt-1 text-xs text-amber-800">A saída está bloqueada até a conferência do saldo na aba Posições e estoque.</div>}</div>}
          {!selectedEntry && lpnBarcode && lpnMatches.length === 0 && <p className="rounded bg-amber-50 p-3 text-xs text-amber-800">LPN não localizada. Confira o código ou registre a entrada no WMS.</p>}
        </section>

        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2"><Barcode className="h-4 w-4 text-emerald-700" /><h3 className="text-sm font-semibold text-slate-900">2. Parede de produção</h3></div>
          <label className="block text-xs font-medium text-gray-600">Bipe o código de baixa da parede
            <input ref={wallInputRef} required value={wallBarcode} onChange={(event) => setWallBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); quantityInputRef.current?.focus(); } }} placeholder="Código da OP, pedido ou parede" className="mt-1 w-full rounded border border-gray-300 px-3 py-2.5 font-mono text-base" />
          </label>
          {linkedOrder ? <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950"><div className="font-semibold">OP reconhecida: {linkedOrder.ordem}</div><div className="mt-1">Pedido {linkedOrder.pedido} · {linkedOrder.itemModel} · {linkedOrder.clienteSolicitante}</div><div className="mt-1 text-blue-800">A baixa de material será registrada no WMS; esta leitura não finaliza a OP.</div></div> : wallBarcode.trim() ? <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Código de parede será registrado como referência. Não há OP/PV com este código cadastrado.</div> : <p className="rounded bg-slate-50 p-3 text-xs text-gray-500">A OP ou o pedido será identificado automaticamente se o código corresponder a uma ordem cadastrada.</p>}
          {selectedEntry && selectedEntry.quantity != null && selectedEntry.quantity > 0 && (selectedEntry.serialized ? <label className="block text-xs font-medium text-gray-600">Seriais que sairão
            <textarea required rows={4} value={serialInput} onChange={(event) => setSerialInput(event.target.value)} placeholder="Bipe ou informe os seriais, um por linha" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 font-mono text-sm" /><span className="mt-1 block font-normal text-gray-400">Disponíveis: {selectedEntry.serials.join(', ')}</span>
          </label> : <label className="block text-xs font-medium text-gray-600">Quantidade para a produção
            <input ref={quantityInputRef} required type="number" min="0.001" max={selectedEntry.quantity} step={selectedEntry.unit === 'MT' ? '0.001' : '1'} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" />
          </label>)}
          <button type="submit" disabled={!selectedEntry || selectedEntry.quantity == null || selectedEntry.quantity <= 0 || lpnMatches.length > 1 && !entryId} className="inline-flex items-center gap-2 rounded bg-emerald-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><ClipboardMinus className="h-4 w-4" />Confirmar baixa de produção</button>
        </section>
      </form>
      {notice && <div role="status" className="border-l-4 border-blue-600 bg-blue-50 px-3 py-2 text-xs text-blue-900">{notice}</div>}
    </div>
  );
}

function InventoryCharts({ data }: { data: WmsData }) {
  const [unit, setUnit] = useState<Unit>('UN');
  const [periodDays, setPeriodDays] = useState<30 | 90 | 365>(30);
  const availableEntries = data.entries.filter((entry) => entry.quantity != null && entry.quantity > 0);
  const knownUnits = availableEntries
    .filter((entry) => entry.unit === 'UN')
    .reduce((sum, entry) => sum + getBoxAdjustedQuantity(entry), 0);
  const knownMeters = availableEntries
    .filter((entry) => entry.unit === 'MT')
    .reduce((sum, entry) => sum + getBoxAdjustedQuantity(entry), 0);
  const pendingCount = data.entries.filter((entry) => entry.quantity == null).length;
  const itemTotals = new Map<string, { name: string; code: string; quantity: number }>();
  const locationTotals = new Map<string, number>();

  availableEntries.filter((entry) => entry.unit === unit).forEach((entry) => {
    const key = `${entry.itemCode}\u0000${entry.itemName}`;
    const item = itemTotals.get(key) ?? {
      name: entry.itemName || 'Item sem descrição',
      code: entry.itemCode || 'Sem SKU',
      quantity: 0,
    };
    const entryQuantity = getBoxAdjustedQuantity(entry);
    item.quantity += entryQuantity;
    itemTotals.set(key, item);
    locationTotals.set(entry.location, (locationTotals.get(entry.location) ?? 0) + entryQuantity);
  });

  const sortedItems = [...itemTotals.values()].sort((left, right) => right.quantity - left.quantity);
  const topItems = sortedItems.slice(0, 8);
  const topLocations = [...locationTotals.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 8);
  const totalItems = new Set(availableEntries.map((entry) => `${entry.itemCode}\u0000${entry.itemName}`)).size;
  const selectedTotal = unit === 'UN' ? knownUnits : knownMeters;
  const formatValue = (value: number) => formatQuantity(value, unit);
  const chartColors = ['#f59e0b', '#fb923c', '#38bdf8', '#a78bfa', '#34d399', '#f472b6'];
  const donutItems = sortedItems.slice(0, 5).map((item, index) => ({
    label: item.name,
    detail: `SKU ${item.code}`,
    quantity: item.quantity,
    color: chartColors[index % chartColors.length],
  }));
  const otherQuantity = sortedItems.slice(5).reduce((sum, item) => sum + item.quantity, 0);
  if (otherQuantity > 0) {
    donutItems.push({ label: 'Outros itens', detail: '', quantity: otherQuantity, color: '#64748b' });
  }
  let cumulativePercent = 0;
  const donutGradient = donutItems.map((item) => {
    const start = cumulativePercent;
    cumulativePercent += selectedTotal > 0 ? (item.quantity / selectedTotal) * 100 : 0;
    return `${item.color} ${start}% ${cumulativePercent}%`;
  }).join(', ');

  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - periodDays + 1);
  const bucketCount = periodDays === 30 ? 30 : periodDays === 90 ? 13 : 12;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const start = new Date(startDate);
    let end = new Date(startDate);
    let label: string;
    if (periodDays === 30) {
      start.setDate(start.getDate() + index);
      end = new Date(start);
      label = index % 5 === 0 || index === bucketCount - 1
        ? start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '';
    } else if (periodDays === 90) {
      start.setDate(start.getDate() + index * 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      label = index % 2 === 0 || index === bucketCount - 1
        ? start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '';
    } else {
      start.setDate(1);
      start.setMonth(now.getMonth() - (bucketCount - 1) + index);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      label = start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    }
    return { start, end, label, exits: 0, transfers: 0 };
  });

  data.movements.forEach((movement) => {
    if (movement.unit !== unit) return;
    const movementDate = new Date(movement.date);
    if (Number.isNaN(movementDate.getTime()) || movementDate < startDate || movementDate > now) return;
    const bucket = buckets.find((candidate) => movementDate >= candidate.start && movementDate <= candidate.end);
    if (!bucket) return;
    if (movement.kind === 'transferencia') bucket.transfers += movement.quantity;
    else bucket.exits += movement.quantity;
  });
  const maxMovement = Math.max(0, ...buckets.map((bucket) => bucket.exits + bucket.transfers));
  const periodLabel = periodDays === 30 ? 'Últimos 30 dias' : periodDays === 90 ? 'Últimos 90 dias' : 'Últimos 12 meses';

  return (
    <section role="tabpanel" aria-label="Gráficos do estoque" className="overflow-hidden rounded-xl bg-[#101a30] text-slate-100 shadow-lg">
      <div className="grid min-h-[620px] grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#0c1528] p-4 md:border-b-0 md:border-r">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Filtros do painel</p>
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Período</p>
            <div className="grid grid-cols-3 gap-1 md:grid-cols-1">
              {([
                [30, '30 DIAS'],
                [90, '90 DIAS'],
                [365, '12 MESES'],
              ] as const).map(([days, label]) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={periodDays === days}
                  onClick={() => setPeriodDays(days)}
                  className={`rounded px-2.5 py-2 text-left text-[10px] font-bold tracking-wide transition ${
                    periodDays === days ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Unidade</p>
            <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
              {(['UN', 'MT'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={unit === option}
                  onClick={() => setUnit(option)}
                  className={`rounded px-2.5 py-2 text-left text-[10px] font-bold tracking-wide transition ${
                    unit === option ? 'bg-slate-100 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {option === 'UN' ? 'UNIDADES' : 'METROS'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pendências</p>
            <p className={`mt-1 text-2xl font-bold ${pendingCount ? 'text-amber-400' : 'text-emerald-400'}`}>{pendingCount}</p>
            <p className="text-[10px] leading-relaxed text-slate-400">lotes aguardando conferência</p>
          </div>
          <p className="mt-5 text-[10px] leading-relaxed text-slate-500">
            O saldo atual não muda com o período. O filtro de datas se aplica ao histórico de movimentações.
          </p>
        </aside>

        <div className="min-w-0 p-4 sm:p-6">
          <header className="mb-5 border-b border-white/10 pb-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">WMS · Inteligência de estoque</p>
            <h2 className="mt-1 text-lg font-bold tracking-wide text-white sm:text-xl">PAINEL DE ESTOQUE</h2>
            <p className="mt-1 text-[10px] text-slate-400">Posição atual e movimentações registradas · {periodLabel}</p>
          </header>

          <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {[
              { label: 'SALDO EM UNIDADES', value: formatQuantity(knownUnits, 'UN'), color: 'text-amber-300' },
              { label: 'SALDO EM METROS', value: formatQuantity(knownMeters, 'MT'), color: 'text-sky-300' },
              { label: 'ITENS COM SALDO', value: String(totalItems), color: 'text-emerald-300' },
              { label: 'POSIÇÕES OCUPADAS', value: String(locationTotals.size), color: 'text-violet-300' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-lg border border-white/10 bg-[#17243d] px-3 py-2.5">
                <p className="text-[9px] font-semibold tracking-wide text-slate-400">{metric.label}</p>
                <p className={`mt-1 text-base font-bold sm:text-lg ${metric.color}`}>{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-lg border border-white/10 bg-[#17243d] p-3.5 sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-white">MAIORES SALDOS POR ITEM</h3>
                  <p className="mt-0.5 text-[10px] text-slate-400">Top {Math.min(topItems.length, 8)} · {unit}</p>
                </div>
                <Boxes className="h-4 w-4 text-amber-400" />
              </div>
              {topItems.length ? (
                <ol className="space-y-3">
                  {topItems.map((item, index) => (
                    <li key={`${item.code}-${item.name}`}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px]">
                        <span className="min-w-0 truncate text-slate-200">
                          <span className="mr-1.5 text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                          {item.name}<span className="ml-1 text-slate-500">· {item.code}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-white">{formatValue(item.quantity)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                          style={{ width: `${Math.max(2, (item.quantity / (topItems[0]?.quantity || 1)) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : <p className="py-8 text-center text-xs text-slate-400">Não há saldo conferido em {unit} para exibir.</p>}
            </section>

            <section className="rounded-lg border border-white/10 bg-[#17243d] p-3.5 sm:p-4">
              <div className="mb-4 border-b border-white/10 pb-2.5">
                <h3 className="text-xs font-bold text-white">COMPOSIÇÃO DO ESTOQUE</h3>
                <p className="mt-0.5 text-[10px] text-slate-400">Participação por item · {unit}</p>
              </div>
              {donutItems.length ? (
                <>
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                    <div
                      role="img"
                      aria-label={`Composição do estoque em ${unit}`}
                      className="relative h-36 w-36 shrink-0 rounded-full"
                      style={{ background: `conic-gradient(${donutGradient})` }}
                    >
                      <div className="absolute inset-[25%] flex flex-col items-center justify-center rounded-full bg-[#17243d] text-center">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Total</span>
                        <span className="text-xs font-bold text-white">{formatValue(selectedTotal)}</span>
                      </div>
                    </div>
                    <ul className="w-full space-y-2">
                      {donutItems.map((item) => (
                        <li key={item.label} className="flex items-center gap-2 text-[10px]">
                          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="min-w-0 flex-1 truncate text-slate-300">{item.label}</span>
                          <span className="shrink-0 font-semibold text-white">
                            {selectedTotal > 0 ? `${((item.quantity / selectedTotal) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '0%'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : <p className="py-8 text-center text-xs text-slate-400">Não há saldo conferido em {unit} para exibir.</p>}
            </section>
          </div>

          <section className="mt-3 rounded-lg border border-white/10 bg-[#17243d] p-3.5 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-white">MOVIMENTAÇÕES REGISTRADAS NO WMS</h3>
                <p className="mt-0.5 text-[10px] text-slate-400">Baixas e transferências · {periodLabel} · {unit}</p>
              </div>
              <div className="flex items-center gap-3 text-[9px] text-slate-300">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-amber-500 to-orange-400" />Baixas</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400" />Transferências</span>
              </div>
            </div>
            {maxMovement > 0 ? (
              <div className="flex h-36 items-end gap-1 border-b border-white/10 px-1 sm:gap-2">
                {buckets.map((bucket, index) => {
                  const total = bucket.exits + bucket.transfers;
                  const exitHeight = maxMovement ? (bucket.exits / maxMovement) * 100 : 0;
                  const transferHeight = maxMovement ? (bucket.transfers / maxMovement) * 100 : 0;
                  return (
                    <div
                      key={`${bucket.start.toISOString()}-${index}`}
                      title={`${bucket.label || bucket.start.toLocaleDateString('pt-BR')}: ${formatValue(bucket.exits)} em baixas, ${formatValue(bucket.transfers)} em transferências`}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    >
                      {total > 0 && <span className="mb-1 hidden text-[8px] text-slate-300 sm:block">{formatValue(total)}</span>}
                      <div className="flex h-[78%] w-full items-end justify-center gap-px">
                        <div className="w-1/2 rounded-t-sm bg-gradient-to-t from-amber-600 to-orange-400" style={{ height: `${exitHeight}%` }} />
                        <div className="w-1/2 rounded-t-sm bg-sky-400" style={{ height: `${transferHeight}%` }} />
                      </div>
                      <span className="mt-1 h-3 text-[8px] text-slate-400">{bucket.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-7 text-center text-xs text-slate-400">
                Nenhuma baixa ou transferência foi registrada no WMS neste período. Entradas de estoque ainda não são lançadas no histórico de movimentações.
              </p>
            )}
          </section>
          <p className="mt-3 text-[9px] leading-relaxed text-slate-500">
            Valores calculados a partir do WMS deste navegador. Saldos pendentes de conferência são excluídos dos gráficos; unidades e metros permanecem separados.
          </p>
        </div>
      </div>
    </section>
  );
}

type ParsedWmsLocation = {
  zone: string;
  rack: string;
  position: number;
  side: 'left' | 'right';
  level: string;
};

function parseWmsLocation(value: string): ParsedWmsLocation | null {
  const match = value.trim().toLocaleUpperCase('pt-BR').replace(/\s+/g, '')
    .match(/^([A-Z])(\d{3,4})(\d{4})(00|10|20|30)$/);
  if (!match) return null;
  const section = Number(match[2]);
  const position = Number(match[3]);
  if (section < 1 || position === 0) return null;
  const rackNumber = Math.ceil(section / 2);
  return {
    zone: match[1],
    rack: `${match[1]}${String(rackNumber).padStart(3, '0')}`,
    position,
    side: section % 2 === 1 ? 'left' : 'right',
    level: match[4],
  };
}

const STANDARD_RACK_LEVELS = [
  { code: '30', label: '3º NÍVEL' },
  { code: '20', label: '2º NÍVEL' },
  { code: '10', label: '1º NÍVEL' },
  { code: '00', label: 'TÉRREO' },
] as const;

const EXTRA_RACK_LEVELS = [
  { code: '20', label: '2º NÍVEL' },
  { code: '10', label: '1º NÍVEL' },
  { code: '00', label: 'TÉRREO' },
] as const;

function getRackSlots(rack: string) {
  const levels = rack.startsWith('E') ? EXTRA_RACK_LEVELS : STANDARD_RACK_LEVELS;
  return levels.flatMap(({ code, label }) =>
    (['left', 'right'] as const).map((side) => ({
      id: `${code}-${side}`,
      level: code,
      levelLabel: label,
      side,
      sideLabel: side === 'left' ? 'ESQUERDA' : 'DIREITA',
    }))
  );
}

function LegacyLiveStockMap({ data, onBack }: { data: WmsData; onBack?: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selectedRack, setSelectedRack] = useState('A001');
  const [selectedSlot, setSelectedSlot] = useState('00-left');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(new Date());

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(document.fullscreenElement === mapRef.current);
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  useEffect(() => {
    setUpdatedAt(new Date());
  }, [data]);

  useEffect(() => {
    const timer = window.setInterval(() => setUpdatedAt(new Date()), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const locations = useMemo(() => data.entries.map((entry) => ({
    entry,
    parsed: parseWmsLocation(entry.location),
  })), [data.entries]);

  const rackNames = useMemo(() => {
    const names = new Set(['A001', 'A002', 'A003', 'A004', 'E001']);
    locations.forEach(({ parsed }) => {
      if (parsed) names.add(parsed.rack);
    });
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [locations]);

  const rackTitle = (rack: string) =>
    rack.startsWith('E') ? 'RACK EXTRA' : `RACK ${Number(rack.slice(1))}`;

  const rackEntries = locations.filter(({ parsed }) => parsed?.rack === selectedRack);
  const occupiedLocations = locations.filter(({ parsed, entry }) =>
    parsed && entry.quantity != null && entry.quantity > 0
  );
  const occupiedPositionCount = new Set(occupiedLocations.map(({ parsed }) =>
    `${parsed?.rack}-${parsed?.level}-${parsed?.side}`
  )).size;
  const knownUnits = data.entries.reduce((sum, entry) =>
    sum + (entry.quantity != null && entry.unit === 'UN' && entry.quantity > 0 ? entry.quantity : 0), 0);
  const knownMeters = data.entries.reduce((sum, entry) =>
    sum + (entry.quantity != null && entry.unit === 'MT' && entry.quantity > 0 ? entry.quantity : 0), 0);
  const pendingCount = data.entries.filter((entry) => entry.quantity == null).length;
  const unassignedEntries = locations.filter(({ parsed }) => !parsed);

  const slotEntries = (rack: string, level: string, side: ParsedWmsLocation['side']) =>
    locations.filter(({ parsed }) =>
      parsed?.rack === rack && parsed.level === level && parsed.side === side
    );

  const slotStatus = (rack: string, level: string, side: ParsedWmsLocation['side']) => {
    const entries = slotEntries(rack, level, side);
    const hasPending = entries.some(({ entry }) => entry.quantity == null);
    const hasAvailable = entries.some(({ entry }) => (entry.quantity ?? 0) > 0);
    return hasPending ? 'pending' : hasAvailable ? 'occupied' : 'empty';
  };

  const selectedSlotInfo = getRackSlots(selectedRack).find(({ id }) => id === selectedSlot)
    ?? getRackSlots(selectedRack)[0];
  const selectedEntries = selectedSlotInfo
    ? slotEntries(selectedRack, selectedSlotInfo.level, selectedSlotInfo.side)
    : [];
  const rackHasInventory = (rack: string) => locations.some(({ parsed, entry }) =>
    parsed?.rack === rack && ((entry.quantity ?? 0) > 0 || entry.quantity == null)
  );

  const toggleFullscreen = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (mapRef.current?.requestFullscreen) await mapRef.current.requestFullscreen();
      else setFullscreenError('Tela cheia não está disponível neste navegador.');
    } catch (error) {
      console.error('Falha ao alternar a tela cheia do mapa:', error);
      setFullscreenError('Não foi possível alternar para tela cheia. Verifique a permissão do navegador.');
    }
  };

  const movementLabel = (movement: StockMovement) =>
    movement.kind === 'transferencia' ? 'Transferência' :
      movement.kind === 'saida_producao' ? 'Saída produção' : 'Baixa';

  return (
    <section ref={mapRef} className="live-stock-map min-h-full bg-[#0b1425] p-3 text-slate-100 sm:p-5">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-sky-300/20 bg-gradient-to-r from-[#103653] to-[#10243a] px-4 py-3 shadow-lg sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-200">Sala de estoque · WMS</p>
            <h1 className="mt-1 text-xl font-black tracking-wide text-white sm:text-3xl">MAPEAMENTO AO VIVO DO ESTOQUE</h1>
            <p className="mt-1 text-xs text-sky-100/75">Planta de posições atualizada conforme entradas, baixas e transferências registradas</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao WMS
              </button>
            )}
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFullscreen ? 'Sair da tela cheia' : 'Maximizar tela'}
            </button>
          </div>
        </header>

        {fullscreenError && <p role="alert" className="rounded border border-rose-400/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">{fullscreenError}</p>}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'RACKS MAPEADOS', value: String(rackNames.length), detail: '4 racks padrão + 1 rack extra', tone: 'text-sky-300' },
            { label: 'ENDEREÇOS COM SALDO', value: String(occupiedPositionCount), detail: '8 opções por rack A · 6 no rack E', tone: 'text-emerald-300' },
            { label: 'SALDO CONFERIDO', value: `${knownUnits.toLocaleString('pt-BR')} UN`, detail: `${knownMeters.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} MT`, tone: 'text-amber-300' },
            { label: 'A CONFERIR', value: String(pendingCount), detail: 'não disponível para movimentação', tone: pendingCount ? 'text-rose-300' : 'text-slate-300' },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg border border-white/10 bg-[#14233a] px-3 py-2.5">
              <p className="text-[9px] font-semibold tracking-wider text-slate-400">{metric.label}</p>
              <p className={`mt-1 text-base font-black sm:text-xl ${metric.tone}`}>{metric.value}</p>
              <p className="mt-0.5 truncate text-[9px] text-slate-500">{metric.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <section className="overflow-hidden rounded-lg border-[6px] border-slate-500 bg-[#d6d2c8] shadow-inner sm:border-[10px]">
              <div className="flex min-h-[420px] flex-col justify-between bg-[linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px)] bg-[size:40px_40px] p-4 text-slate-900 sm:min-h-[500px] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="rounded border border-sky-300 bg-sky-100 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-sky-950">
                    ENTRADA / EXPEDIÇÃO
                  </div>
                  <div className="rounded border border-slate-400 bg-white/90 px-3 py-2 text-[10px] font-bold text-slate-700">
                    ÁREA ADMINISTRATIVA
                  </div>
                </div>

                <div className="my-4 flex items-center gap-3 sm:my-6">
                  <span className="h-px flex-1 bg-sky-700/70" />
                  <span className="rounded bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-sky-950">
                    Corredor principal do estoque
                  </span>
                  <span className="h-px flex-1 bg-sky-700/70" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  {rackNames.map((rack) => {
                    const rackSlots = getRackSlots(rack);
                    const rackOccupied = rackSlots.filter(({ level, side }) =>
                      slotStatus(rack, level, side) === 'occupied'
                    ).length;
                    const rackNumber = Number(rack.slice(1));
                    const firstSection = String(rackNumber * 2 - 1).padStart(3, '0');
                    const secondSection = String(rackNumber * 2).padStart(3, '0');
                    const selected = rack === selectedRack;
                    return (
                      <button
                        key={rack}
                        type="button"
                        onClick={() => {
                          setSelectedRack(rack);
                          const firstOccupied = rackSlots.find(({ level, side }) =>
                            slotStatus(rack, level, side) !== 'empty'
                          );
                          setSelectedSlot(firstOccupied?.id ?? rackSlots[0].id);
                        }}
                        className={`rounded-lg border p-4 text-left shadow-md transition ${
                          selected ? 'border-blue-700 bg-blue-50 ring-2 ring-blue-500' :
                            rackHasInventory(rack) ? 'border-slate-500 bg-white hover:border-blue-400' :
                              'border-slate-400 bg-slate-100 hover:border-blue-400'
                        }`}
                      >
                        <span className={`block text-center text-sm font-black ${selected ? 'text-blue-800' : 'text-slate-700'}`}>{rackTitle(rack)}</span>
                        <span className="mt-1 block text-center text-[10px] font-semibold text-slate-500">{rack[0]}{firstSection} / {rack[0]}{secondSection}</span>
                        <span className="mt-2 block text-center text-[10px] font-semibold text-slate-500">{rackOccupied}/{rackSlots.length} posições ocupadas</span>
                        <span className="my-2 block h-1.5 rounded bg-slate-300">
                          <span className="block h-1.5 rounded bg-emerald-500" style={{ width: `${Math.min(100, (rackOccupied / rackSlots.length) * 100)}%` }} />
                        </span>
                        <span className="space-y-1" aria-label={`Posições do rack ${rack}`}>
                          {(rack.startsWith('E') ? EXTRA_RACK_LEVELS : STANDARD_RACK_LEVELS).map(({ code, label }) => (
                            <span key={code} className="grid grid-cols-[1fr_3px_1fr] items-stretch gap-1.5" title={`${label} · esquerda e direita`}>
                              {(['left', 'divider', 'right'] as const).map((side) => {
                                if (side === 'divider') return <span key={side} className="rounded-full bg-slate-500" />;
                                const status = slotStatus(rack, code, side);
                                const selectedSlotOnRack = rack === selectedRack && selectedSlot === `${code}-${side}`;
                                const entries = slotEntries(rack, code, side);
                                const section = String(rackNumber * 2 - (side === 'left' ? 1 : 0)).padStart(3, '0');
                                const address = `${rack[0]}${section}0001${code}`;
                                const preview = entries.length
                                  ? entries.map(({ entry }) => `${entry.itemName} (${entry.quantity == null ? `a conferir: ${entry.rawQuantity}` : formatQuantity(entry.quantity, entry.unit)})`).join(' · ')
                                  : 'Sem item armazenado';
                                return (
                                  <span
                                    key={side}
                                    title={`${address} · ${preview}`}
                                    className={`group/slot relative h-5 rounded-[3px] ${
                                      status === 'pending' ? 'bg-amber-400' :
                                        status === 'occupied' ? 'bg-emerald-500' :
                                          'bg-slate-300'
                                    } ${selectedSlotOnRack ? 'ring-1 ring-blue-700 ring-offset-1' : ''}`}
                                  >
                                    <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-slate-600 bg-slate-950 p-2 text-left text-[10px] font-normal leading-relaxed text-white shadow-xl group-hover/slot:block">
                                      <span className="block font-bold text-sky-200">{label} · {side === 'left' ? 'ESQUERDA' : 'DIREITA'}</span>
                                      <span className="block font-mono text-slate-400">{address}</span>
                                      {entries.length ? entries.map(({ entry }) => (
                                        <span key={entry.id} className="mt-1 block">
                                          {entry.itemName} · SKU {entry.itemCode} · {entry.quantity == null ? `A conferir: ${entry.rawQuantity}` : formatQuantity(entry.quantity, entry.unit)}
                                        </span>
                                      )) : <span className="mt-1 block text-slate-300">Sem item armazenado nesta posição.</span>}
                                    </span>
                                  </span>
                                );
                              })}
                            </span>
                          ))}
                        </span>
                        <span className="mt-2 block text-center text-[9px] text-slate-500">{rackSlots.length} opções de armazenagem</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-wider text-sky-950 sm:mt-6">
                  <span>←</span>
                  <span>Corredor de acesso aos racks</span>
                  <span>→</span>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#14233a] p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-white">DETALHE DO {rackTitle(selectedRack)} · {selectedRack[0]}{String(Number(selectedRack.slice(1)) * 2 - 1).padStart(3, '0')} / {selectedRack[0]}{String(Number(selectedRack.slice(1)) * 2).padStart(3, '0')}</h2>
                  <p className="text-[10px] text-slate-400">Cada nível tem duas posições lado a lado, separadas pela barra divisória.</p>
                </div>
                <div className="flex flex-wrap gap-3 text-[9px] text-slate-300">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Com saldo</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />A conferir</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-600" />Vazia</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-semibold text-slate-300">
                  Navegue pelas {getRackSlots(selectedRack).length} posições de armazenagem:
                </p>
                <div className="space-y-1.5">
                  {(selectedRack.startsWith('E') ? EXTRA_RACK_LEVELS : STANDARD_RACK_LEVELS).map(({ code, label }) => (
                    <div key={code} className="grid grid-cols-[minmax(0,1fr)_5px_minmax(0,1fr)] gap-1">
                      {(['left', 'divider', 'right'] as const).map((side) => {
                        if (side === 'divider') {
                          return <div key="divider" role="separator" aria-label="Barra divisória entre as duas posições" className="rounded bg-slate-500" />;
                        }
                        const status = slotStatus(selectedRack, code, side);
                        const sideEntries = slotEntries(selectedRack, code, side);
                        const slotId = `${code}-${side}`;
                        const selected = selectedSlot === slotId;
                        const sideLabel = side === 'left' ? 'ESQUERDA' : 'DIREITA';
                        const section = String(Number(selectedRack.slice(1)) * 2 - (side === 'left' ? 1 : 0)).padStart(3, '0');
                        const address = `${selectedRack[0]}${section}0001${code}`;
                        const preview = sideEntries.length
                          ? sideEntries.map(({ entry }) => `${entry.itemName} · SKU ${entry.itemCode} · ${entry.quantity == null ? `a conferir: ${entry.rawQuantity}` : formatQuantity(entry.quantity, entry.unit)}`).join(' · ')
                          : 'Sem item armazenado nesta posição.';
                        return (
                          <button
                            key={side}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${label}, posição ${sideLabel}, endereço ${address}, ${status === 'empty' ? 'vazia' : status === 'pending' ? 'a conferir' : 'com saldo'}`}
                            title={`${address} · ${preview}`}
                            onClick={() => setSelectedSlot(slotId)}
                            className={`group/slot relative flex min-h-12 min-w-0 items-center justify-between gap-2 rounded border px-3 py-2 text-left transition ${
                              status === 'pending' ? 'border-amber-300/40 bg-amber-400/10 text-amber-100' :
                                status === 'occupied' ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100' :
                                  'border-white/10 bg-slate-800 text-slate-300'
                            } ${selected ? 'ring-2 ring-sky-400' : 'hover:border-sky-300'}`}
                          >
                            <span className="min-w-0">
                              <span className="block text-[9px] font-black">{label} · {sideLabel}</span>
                              <span className="mt-0.5 block truncate font-mono text-[9px] opacity-70">{address}</span>
                            </span>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold ${
                              status === 'pending' ? 'bg-amber-400/20 text-amber-200' :
                                status === 'occupied' ? 'bg-emerald-400/20 text-emerald-200' :
                                  'bg-slate-700 text-slate-400'
                            }`}>
                              {status === 'pending' ? 'A CONFERIR' : status === 'occupied' ? 'COM SALDO' : 'VAZIA'}
                            </span>
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-64 -translate-x-1/2 rounded-md border border-slate-600 bg-slate-950 p-2 text-left text-[10px] font-normal leading-relaxed text-white shadow-xl group-hover/slot:block group-focus-visible/slot:block">
                              <span className="block font-mono text-sky-200">{address}</span>
                              {sideEntries.length ? sideEntries.map(({ entry }) => (
                                <span key={entry.id} className="mt-1 block">
                                  {entry.itemName} · SKU {entry.itemCode} · {entry.quantity == null ? `A conferir: ${entry.rawQuantity}` : formatQuantity(entry.quantity, entry.unit)}
                                </span>
                              )) : <span className="mt-1 block text-slate-300">Sem item armazenado nesta posição.</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {selectedSlotInfo && (
                <section className="mt-3 rounded-md border border-sky-300/20 bg-[#0f1b2e] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-black text-white">
                        {selectedSlotInfo.levelLabel} · POSIÇÃO {selectedSlotInfo.sideLabel}
                      </h3>
                      <p className="mt-0.5 font-mono text-[9px] text-sky-200">
                        {selectedEntries[0]?.entry.location ?? (() => {
                          const section = String(Number(selectedRack.slice(1)) * 2 - (selectedSlotInfo.side === 'left' ? 1 : 0)).padStart(3, '0');
                          return `${selectedRack[0]}${section}0001${selectedSlotInfo.level}`;
                        })()}
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-400">
                      {selectedEntries.reduce((sum, { entry }) =>
                        sum + (entry.quantity != null && entry.unit === 'UN' ? entry.quantity : 0), 0
                      ).toLocaleString('pt-BR')} UN · {selectedEntries.reduce((sum, { entry }) =>
                        sum + (entry.quantity != null && entry.unit === 'MT' ? entry.quantity : 0), 0
                      ).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} MT
                    </span>
                  </div>
                  {selectedEntries.length ? (
                    <ul className="mt-2 space-y-2">
                      {selectedEntries.map(({ entry }) => (
                        <li key={entry.id} className="border-t border-white/10 pt-2 text-[10px]">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 font-semibold text-slate-200">{entry.itemName} <span className="text-slate-500">· SKU {entry.itemCode}</span></span>
                            <span className={`shrink-0 font-bold ${entry.quantity == null ? 'text-amber-300' : 'text-emerald-300'}`}>
                              {entry.quantity == null ? `Conferir: ${entry.rawQuantity}` : formatQuantity(entry.quantity, entry.unit)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-slate-500">Lote {entry.lot} · {entry.boxCount} caixa(s) · {entry.status} · endereço {entry.location}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-[10px] text-slate-500">Sem saldo registrado nesta posição.</p>}
                </section>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-[9px] text-slate-500">
                <MapPin className="h-3 w-3" />
                Cada posição usa o formato zona + código da posição + vão + nível; finais 00, 10, 20 e 30 representam térreo e os três níveis acima.
              </p>
            </section>
          </div>

          <aside className="space-y-3">
            <section className="rounded-lg border border-white/10 bg-[#14233a] p-3.5">
              <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <div>
                  <h2 className="text-xs font-black text-white">STATUS DO MAPA</h2>
                  <p className="text-[9px] text-slate-400">Sincronizado com o WMS deste navegador</p>
                </div>
              </div>
              <p className="flex items-center gap-2 text-[10px] text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                AO VIVO · consulta a cada 3 segundos
              </p>
              <p className="mt-2 text-[9px] text-slate-500">Última leitura: {updatedAt.toLocaleTimeString('pt-BR')}</p>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#14233a] p-3.5">
              <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
                <MapPinned className="h-4 w-4 text-sky-300" />
                <h2 className="text-xs font-black text-white">ENDEREÇAMENTO</h2>
              </div>
              <div className="space-y-2 text-[10px] text-slate-300">
                <p><span className="font-bold text-sky-300">E</span> · zona</p>
                <p><span className="font-bold text-sky-300">001–008</span> · pares consecutivos formam os 4 racks padrão; 001/002 formam o rack extra E</p>
                <p><span className="font-bold text-sky-300">0001</span> · vão do rack</p>
                <p><span className="font-bold text-sky-300">00 / 10 / 20 / 30</span> · térreo e níveis dos racks padrão A</p>
                <p className="border-t border-white/10 pt-2 text-slate-500">Exemplo: E001000100 | E002000100</p>
                <p className="text-amber-300/90">A divisória central separa as duas posições lado a lado no mesmo nível. Os racks padrão têm 4 níveis (8 posições por vão); o rack extra E tem 3 níveis (6 posições por vão).</p>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#14233a] p-3.5">
              <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
                <Boxes className="h-4 w-4 text-amber-300" />
                <h2 className="text-xs font-black text-white">MOVIMENTAÇÕES RECENTES</h2>
              </div>
              {data.movements.length ? (
                <ul className="space-y-2">
                  {data.movements.slice(0, 6).map((movement) => (
                    <li key={movement.id} className="border-b border-white/5 pb-2 text-[9px]">
                      <div className="flex justify-between gap-2">
                        <span className="font-bold text-slate-200">{movementLabel(movement)}</span>
                        <span className="shrink-0 text-slate-500">{new Date(movement.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="mt-0.5 truncate text-slate-400">{movement.itemName} · {formatQuantity(movement.quantity, movement.unit)}</p>
                      <p className="text-slate-500">{movement.locationFrom || '—'}{movement.locationTo ? ` → ${movement.locationTo}` : ''}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[10px] text-slate-500">Ainda não há movimentações registradas.</p>}
            </section>

            {unassignedEntries.length > 0 && (
              <section className="rounded-lg border border-amber-400/30 bg-amber-950/30 p-3.5">
                <h2 className="text-xs font-black text-amber-200">ITENS SEM ENDEREÇO MAPEÁVEL</h2>
                <p className="mt-1 text-[10px] text-amber-100/70">{unassignedEntries.length} registro(s) não seguem o padrão Zona+Código da posição+Vão+Nível (00, 10, 20 ou 30).</p>
                <ul className="mt-2 space-y-1 text-[9px] text-amber-100/80">
                  {unassignedEntries.slice(0, 4).map(({ entry }) => (
                    <li key={entry.id} className="truncate">{entry.location} · {entry.itemName}</li>
                  ))}
                </ul>
              </section>
            )}

            <p className="rounded-lg border border-white/10 bg-[#0f1b2e] p-3 text-[9px] leading-relaxed text-slate-500">
              O mapa atualiza automaticamente a partir do armazenamento local do navegador. Para compartilhar movimentações entre computadores ou usuários, o WMS precisará de uma base online compartilhada.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Planta3DMap({ data, onBack, onSave, syncStatus, notice }: {
  data: WmsData;
  onBack?: () => void;
  onSave: (next: WmsData, message?: string) => void;
  syncStatus: string;
  notice: string;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Carregando a planta 3D…</div>}>
      <WarehouseThreeMap data={data} onSave={onSave} onBack={onBack} syncStatus={syncStatus} notice={notice} />
    </Suspense>
  );
}

export function WarehouseWmsTab({ initialView = 'stock', onExitLiveMap }: {
  initialView?: 'stock' | 'production' | 'live-map' | 'planta3d';
  onExitLiveMap?: () => void;
}) {
  const [data, setData] = useState<WmsData>(readData);
  const dataRef = useRef(JSON.stringify(data));
  const cloudRevisionRef = useRef(0);
  const cloudReadyRef = useRef(!sharedWmsClient);
  const [notice, setNotice] = useState('');
  const [syncStatus, setSyncStatus] = useState(sharedWmsClient ? 'Conectando ao estoque compartilhado…' : 'Modo local · alterações só neste navegador');
  const [activeView, setActiveView] = useState<'stock' | 'production' | 'charts' | 'live-map' | 'planta3d'>(initialView);
  const [query, setQuery] = useState('');
  const [inbound, setInbound] = useState({
    location: '', itemCode: '', itemName: '', lot: '', boxCount: '1', quantity: '1', unit: 'UN' as Unit,
    mode: 'quantity' as 'quantity' | 'serialized', serials: '', supplier: '', invoiceNumber: '', receivedDate: '',
  });
  const [movementForm, setMovementForm] = useState({
    kind: 'baixa' as MovementKind, entryId: '', quantity: '1', destination: '', reference: '', serials: '',
  });
  const [serialEntryId, setSerialEntryId] = useState('');
  const [serialInput, setSerialInput] = useState('');

  useEffect(() => {
    const client = sharedWmsClient;
    if (!client) return;

    let active = true;
    const applyRemoteRow = (row: { data: Partial<WmsData>; revision: number }) => {
      if (row.revision < cloudRevisionRef.current) return;
      const nextData = normalizeData(row.data);
      const serialized = JSON.stringify(nextData);
      cloudRevisionRef.current = row.revision;
      cloudReadyRef.current = true;
      dataRef.current = serialized;
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
        setData(nextData);
        setSyncStatus('Sincronizado · compartilhado');
      } catch (error) {
        console.error('Falha ao atualizar o cache local do WMS:', error);
        setNotice('O estoque online está sincronizado, mas não foi possível atualizar o cache local.');
        setData(nextData);
      }
    };

    const loadSharedWms = async () => {
      try {
        const { data: existing, error } = await client
          .from('warehouse_state')
          .select('data, revision')
          .eq('id', 1)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        if (existing) {
          applyRemoteRow(existing as { data: Partial<WmsData>; revision: number });
          return;
        }

        const initialData = normalizeData(readData());
        const { data: inserted, error: insertError } = await client
          .from('warehouse_state')
          .insert({ id: 1, revision: 0, data: initialData })
          .select('data, revision')
          .single();
        if (insertError) {
          const { data: winner, error: retryError } = await client
            .from('warehouse_state')
            .select('data, revision')
            .eq('id', 1)
            .maybeSingle();
          if (retryError) throw retryError;
          if (!winner) throw insertError;
          if (active) applyRemoteRow(winner as { data: Partial<WmsData>; revision: number });
          return;
        }
        if (active) applyRemoteRow(inserted as { data: Partial<WmsData>; revision: number });
      } catch (error) {
        if (!active) return;
        console.error('Falha ao carregar o estoque compartilhado:', error);
        cloudReadyRef.current = false;
        setSyncStatus('Falha na conexão · edição desabilitada');
        setNotice('Não foi possível conectar ao estoque compartilhado. Verifique a configuração do Supabase e tente recarregar.');
      }
    };

    void loadSharedWms();
    const channel = client
      .channel('warehouse-state-live')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'warehouse_state',
        filter: 'id=eq.1',
      }, (payload) => {
        const row = payload.new as { data: Partial<WmsData>; revision: number };
        if (row.revision > cloudRevisionRef.current) applyRemoteRow(row);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncStatus('Atualização em tempo real indisponível');
        }
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (sharedWmsClient) return;
    const syncWmsData = (event: Event) => {
      if (event.type === 'storage') {
        const storageEvent = event as StorageEvent;
        if (storageEvent.key !== null && storageEvent.key !== STORAGE_KEY) return;
      }
      const nextData = readData();
      const serialized = JSON.stringify(nextData);
      if (serialized === dataRef.current) return;
      dataRef.current = serialized;
      setData(nextData);
    };
    window.addEventListener('storage', syncWmsData);
    window.addEventListener('kiraso_wms_inventory_sync', syncWmsData);
    const refreshTimer = window.setInterval(() => syncWmsData(new Event('poll')), 3000);
    return () => {
      window.removeEventListener('storage', syncWmsData);
      window.removeEventListener('kiraso_wms_inventory_sync', syncWmsData);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const selectedEntry = data.entries.find((entry) => entry.id === movementForm.entryId);
  const filteredEntries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    if (!term) return data.entries;
    return data.entries.filter((entry) => [entry.location, entry.itemCode, entry.itemName, entry.lot, entry.status]
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(term)));
  }, [data.entries, query]);

  const positions = useMemo(() => {
    const summary = new Map<string, { rows: number; boxes: number; units: number; meters: number; pending: number }>();
    data.entries.forEach((entry) => {
      const current = summary.get(entry.location) ?? { rows: 0, boxes: 0, units: 0, meters: 0, pending: 0 };
      current.rows += 1;
      current.boxes += entry.boxCount;
      if (entry.quantity == null) current.pending += 1;
      else if (entry.unit === 'MT') current.meters += entry.quantity;
      else current.units += entry.quantity;
      summary.set(entry.location, current);
    });
    return [...summary.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [data.entries]);

  const knownUnits = data.entries.reduce((total, entry) => total + (entry.quantity != null && entry.unit === 'UN' ? entry.quantity : 0), 0);
  const knownMeters = data.entries.reduce((total, entry) => total + (entry.quantity != null && entry.unit === 'MT' ? entry.quantity : 0), 0);
  const pendingCount = data.entries.filter((entry) => entry.quantity == null).length;

  const persist = (next: WmsData, successMessage = 'Movimentação salva neste navegador.') => {
    const client = sharedWmsClient;
    if (client) {
      if (!cloudReadyRef.current) {
        setNotice('O estoque compartilhado ainda não está disponível. Nenhuma alteração foi salva.');
        return;
      }
      const expectedRevision = cloudRevisionRef.current;
      setSyncStatus('Salvando no estoque compartilhado…');
      void (async () => {
        try {
          const { data: saved, error } = await client
            .from('warehouse_state')
            .update({ data: next, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
            .eq('id', 1)
            .eq('revision', expectedRevision)
            .select('revision')
            .maybeSingle();
          if (error) throw error;
          if (!saved) {
            const { data: latest, error: loadError } = await client
              .from('warehouse_state')
              .select('data, revision')
              .eq('id', 1)
              .single();
            if (loadError) throw loadError;
            const remoteData = normalizeData(latest.data as Partial<WmsData>);
            cloudRevisionRef.current = latest.revision;
            dataRef.current = JSON.stringify(remoteData);
            setData(remoteData);
            setSyncStatus('Sincronizado · compartilhado');
            setNotice('Outra pessoa alterou o estoque ao mesmo tempo. A versão mais recente foi carregada; refaça sua movimentação.');
            return;
          }
          cloudRevisionRef.current = saved.revision;
          const serialized = JSON.stringify(next);
          dataRef.current = serialized;
          setData(next);
          try {
            localStorage.setItem(STORAGE_KEY, serialized);
            window.dispatchEvent(new CustomEvent('kiraso_wms_inventory_sync'));
          } catch (storageError) {
            console.error('Falha ao atualizar o cache local do WMS:', storageError);
            setNotice('Alteração salva online, mas o cache local não pôde ser atualizado.');
          }
          setSyncStatus('Sincronizado · compartilhado');
          setNotice(successMessage);
        } catch (error) {
          console.error('Falha ao salvar no estoque compartilhado:', error);
          setSyncStatus('Falha ao salvar · tente novamente');
          setNotice('Não foi possível salvar no estoque compartilhado. Nenhuma alteração foi aplicada.');
        }
      })();
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      dataRef.current = JSON.stringify(next);
      setData(next);
      window.dispatchEvent(new CustomEvent('kiraso_wms_inventory_sync'));
      setNotice(successMessage);
    } catch {
      setNotice('Não foi possível salvar os dados neste navegador.');
    }
  };

  const receiveStock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const serials = inbound.mode === 'serialized' ? parseSerials(inbound.serials) : [];
    const quantity = inbound.mode === 'serialized' ? serials.length : Number(inbound.quantity);
    const boxCount = Number(inbound.boxCount);
    if (inbound.unit === 'MT' && inbound.mode === 'serialized') {
      setNotice('Itens serializados devem usar unidade UN.');
      return;
    }
    if (!isValidQuantity(quantity, inbound.unit) || !Number.isInteger(boxCount) || boxCount < 0) {
      setNotice('Confira a quantidade e o número de caixas informados.');
      return;
    }
    if (inbound.mode === 'serialized' && new Set(serials).size !== serials.length) {
      setNotice('Há números de série repetidos.');
      return;
    }
    const entry: InventoryEntry = {
      id: crypto.randomUUID(), location: inbound.location.trim().toUpperCase(),
      itemCode: inbound.itemCode.trim(), itemName: inbound.itemName.trim(), lot: inbound.lot.trim(),
      boxCount, quantity, rawQuantity: String(quantity), unit: inbound.unit, status: 'ARMAZENADO',
      serialized: inbound.mode === 'serialized', serials, supplier: inbound.supplier.trim(),
      invoiceNumber: inbound.invoiceNumber.trim(), receivedDate: inbound.receivedDate, barcode: '',
    };
    persist({ ...data, entries: [entry, ...data.entries] });
    setInbound({ ...inbound, itemCode: '', itemName: '', boxCount: '1', quantity: '1', serials: '' });
  };

  const resolveQuantity = (event: FormEvent<HTMLFormElement>, entry: InventoryEntry) => {
    event.preventDefault();
    const quantity = Number(new FormData(event.currentTarget).get('quantity'));
    if (!isValidQuantity(quantity, entry.unit)) {
      setNotice(`Informe uma quantidade válida em ${entry.unit}.`);
      return;
    }
    persist({
      ...data,
      entries: data.entries.map((current) => current.id === entry.id
        ? { ...current, quantity, rawQuantity: String(quantity), status: 'ARMAZENADO' }
        : current),
    });
    setNotice(`Quantidade do lote ${entry.lot} conferida e liberada.`);
  };

  const registerExistingSerials = (event: FormEvent<HTMLFormElement>, entryId: string) => {
    event.preventDefault();
    const entry = data.entries.find((current) => current.id === entryId);
    if (!entry || entry.quantity == null || entry.unit !== 'UN' || !Number.isInteger(entry.quantity)) return;
    const serials = parseSerials(serialInput);
    const existingSerials = new Set(data.entries.filter((current) => current.id !== entryId)
      .flatMap((current) => current.serials).map((serial) => serial.toLocaleUpperCase('pt-BR')));
    if (serials.length !== entry.quantity || new Set(serials.map((serial) => serial.toLocaleUpperCase('pt-BR'))).size !== serials.length) {
      setNotice(`Informe exatamente ${entry.quantity} seriais diferentes para este saldo.`);
      return;
    }
    if (serials.some((serial) => existingSerials.has(serial.toLocaleUpperCase('pt-BR')))) {
      setNotice('Um ou mais seriais já estão vinculados a outro saldo.');
      return;
    }
    persist({
      ...data,
      entries: data.entries.map((current) => current.id === entryId
        ? { ...current, serialized: true, serials, quantity: serials.length }
        : current),
    });
    setSerialEntryId('');
    setSerialInput('');
    setNotice(`Seriais vinculados ao SKU ${entry.itemCode}.`);
  };

  const registerMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEntry || selectedEntry.quantity == null || selectedEntry.quantity <= 0) {
      setNotice('Selecione uma linha com saldo conferido.');
      return;
    }
    if (!movementForm.reference.trim()) {
      setNotice('Informe o pedido, OS ou motivo da movimentação.');
      return;
    }
    const isTransfer = movementForm.kind === 'transferencia';
    const serials = isTransfer || !selectedEntry.serialized ? [] : parseSerials(movementForm.serials);
    const quantity = isTransfer ? selectedEntry.quantity
      : selectedEntry.serialized ? serials.length : Number(movementForm.quantity);
    if (!isValidQuantity(quantity, selectedEntry.unit) || quantity > selectedEntry.quantity) {
      setNotice(`Saldo disponível: ${formatQuantity(selectedEntry.quantity, selectedEntry.unit)}.`);
      return;
    }
    if (isTransfer && (!movementForm.destination.trim() || movementForm.destination.trim().toUpperCase() === selectedEntry.location)) {
      setNotice('Informe uma posição de destino diferente da origem.');
      return;
    }
    if (selectedEntry.serialized && !isTransfer && (
      new Set(serials).size !== serials.length || serials.some((serial) => !selectedEntry.serials.includes(serial))
    )) {
      setNotice('Use apenas seriais disponíveis nessa posição, sem repetição.');
      return;
    }

    const locationTo = isTransfer ? movementForm.destination.trim().toUpperCase() : '';
    const entries = data.entries.map((entry) => {
      if (entry.id !== selectedEntry.id) return entry;
      if (isTransfer) return { ...entry, location: locationTo };
      const remaining = selectedEntry.quantity! - quantity;
      return {
        ...entry,
        quantity: remaining,
        rawQuantity: String(remaining),
        boxCount: remaining === 0 ? 0 : entry.boxCount,
        serials: entry.serials.filter((serial) => !serials.includes(serial)),
        status: remaining === 0 ? 'BAIXADO' : entry.status,
      };
    });
    const movement: StockMovement = {
      id: crypto.randomUUID(), date: new Date().toISOString(), kind: movementForm.kind,
      itemCode: selectedEntry.itemCode, itemName: selectedEntry.itemName, lot: selectedEntry.lot,
      locationFrom: selectedEntry.location, locationTo, quantity, unit: selectedEntry.unit,
      reference: movementForm.reference.trim(), serials: isTransfer ? selectedEntry.serials : serials,
      wallBarcode: '', productionOrderCode: '',
    };
    persist({ entries, movements: [movement, ...data.movements] });
    setMovementForm({ ...movementForm, entryId: '', quantity: '1', destination: '', reference: '', serials: '' });
  };

  return (
    <div className="space-y-5">
      {initialView !== 'production' && initialView !== 'live-map' && initialView !== 'planta3d' && <div className="flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist" aria-label="WMS">
        <button type="button" role="tab" aria-selected={activeView === 'stock'} onClick={() => setActiveView('stock')} className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium ${activeView === 'stock' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-slate-800'}`}><MapPin className="h-3.5 w-3.5" />Posições e estoque</button>
        <button type="button" role="tab" aria-selected={activeView === 'charts'} onClick={() => setActiveView('charts')} className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium ${activeView === 'charts' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-slate-800'}`}><Boxes className="h-3.5 w-3.5" />Gráficos do estoque</button>
        <button type="button" role="tab" aria-selected={activeView === 'live-map'} onClick={() => setActiveView('live-map')} className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium ${activeView === 'live-map' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-slate-800'}`}><MapPinned className="h-3.5 w-3.5" />Mapa ao vivo</button>
        <button type="button" role="tab" aria-selected={activeView === 'planta3d'} onClick={() => setActiveView('planta3d')} className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium ${activeView === 'planta3d' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-slate-800'}`}><Boxes className="h-3.5 w-3.5" />Planta 3D editável</button>
        <button type="button" role="tab" aria-selected={activeView === 'production'} onClick={() => setActiveView('production')} className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium ${activeView === 'production' ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-slate-800'}`}><Factory className="h-3.5 w-3.5" />Saída da produção</button>
      </div>}
      {initialView === 'production' || activeView === 'production'
        ? <ProductionIssuePanel data={data} onSave={persist} />
        : initialView === 'live-map' || activeView === 'live-map'
          ? <LegacyLiveStockMap data={data} onBack={onExitLiveMap} />
        : initialView === 'planta3d' || activeView === 'planta3d'
          ? <Planta3DMap data={data} onBack={onExitLiveMap} onSave={persist} syncStatus={syncStatus} notice={notice} />
        : activeView === 'charts' ? <InventoryCharts data={data} /> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3"><div className="text-xs text-gray-500">Saldo conferido</div><div className="mt-1 text-lg font-semibold text-slate-900">{formatQuantity(knownUnits, 'UN')}</div><div className="text-xs text-gray-400">Unidades</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-3"><div className="text-xs text-gray-500">Saldo em comprimento</div><div className="mt-1 text-lg font-semibold text-slate-900">{formatQuantity(knownMeters, 'MT')}</div><div className="text-xs text-gray-400">Metros</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-3"><div className="text-xs text-gray-500">Posições ocupadas</div><div className="mt-1 text-lg font-semibold text-slate-900">{positions.length}</div><div className="text-xs text-gray-400">Endereços distintos</div></div>
        <div className={`rounded-lg border p-3 ${pendingCount ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}><div className="text-xs text-gray-500">Quantidades para conferir</div><div className={`mt-1 text-lg font-semibold ${pendingCount ? 'text-amber-700' : 'text-slate-900'}`}>{pendingCount}</div><div className="text-xs text-gray-400">Não entram no saldo disponível</div></div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <form onSubmit={receiveStock} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3"><PackagePlus className="h-4 w-4 text-emerald-700" /><h2 className="text-sm font-semibold text-slate-900">Entrada / recebimento</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">Posição (endereço)<input required value={inbound.location} onChange={(e) => setInbound({ ...inbound, location: e.target.value })} placeholder="E001000100" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 font-mono text-sm" /></label>
            <label className="text-xs font-medium text-gray-600">Lote / recebimento<input required value={inbound.lot} onChange={(e) => setInbound({ ...inbound, lot: e.target.value })} placeholder="REC463099700" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 font-mono text-sm" /></label>
            <label className="text-xs font-medium text-gray-600">SKU<input required value={inbound.itemCode} onChange={(e) => setInbound({ ...inbound, itemCode: e.target.value })} placeholder="9700" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label>
            <label className="text-xs font-medium text-gray-600">Item<input required value={inbound.itemName} onChange={(e) => setInbound({ ...inbound, itemName: e.target.value })} placeholder="CAIXA 3D - 8410" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label>
            <label className="text-xs font-medium text-gray-600">Unidade<select value={inbound.unit} onChange={(e) => setInbound({ ...inbound, unit: e.target.value as Unit })} className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm"><option value="UN">UN</option><option value="MT">MT</option></select></label>
            <label className="text-xs font-medium text-gray-600">Controle<select value={inbound.mode} onChange={(e) => setInbound({ ...inbound, mode: e.target.value as 'quantity' | 'serialized' })} className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm"><option value="quantity">Por quantidade</option><option value="serialized">Serializado</option></select></label>
            {inbound.mode === 'quantity' ? <label className="text-xs font-medium text-gray-600">Quantidade recebida<input required type="number" min="0.001" step={inbound.unit === 'MT' ? '0.001' : '1'} value={inbound.quantity} onChange={(e) => setInbound({ ...inbound, quantity: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label> : <label className="text-xs font-medium text-gray-600 sm:col-span-2">Seriais recebidos<textarea required rows={3} value={inbound.serials} onChange={(e) => setInbound({ ...inbound, serials: e.target.value })} placeholder="Um serial por linha ou separados por vírgula" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 font-mono text-sm" /><span className="mt-1 block font-normal text-gray-400">Quantidade: {parseSerials(inbound.serials).length} serial(is)</span></label>}
            <label className="text-xs font-medium text-gray-600">Quantidade de caixas<input required type="number" min="0" step="1" value={inbound.boxCount} onChange={(e) => setInbound({ ...inbound, boxCount: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label>
            <label className="text-xs font-medium text-gray-600">Fornecedor (opcional)<input value={inbound.supplier} onChange={(e) => setInbound({ ...inbound, supplier: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label>
            <label className="text-xs font-medium text-gray-600">Nota fiscal (opcional)<input value={inbound.invoiceNumber} onChange={(e) => setInbound({ ...inbound, invoiceNumber: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label>
            <label className="text-xs font-medium text-gray-600">Data do recebimento (opcional)<input type="date" value={inbound.receivedDate} onChange={(e) => setInbound({ ...inbound, receivedDate: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label>
          </div>
          <button type="submit" className="inline-flex items-center gap-2 rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"><ArrowDownToLine className="h-3.5 w-3.5" />Registrar entrada</button>
        </form>

        <form onSubmit={registerMovement} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3"><ClipboardMinus className="h-4 w-4 text-rose-700" /><h2 className="text-sm font-semibold text-slate-900">Baixa ou transferência</h2></div>
          <label className="block text-xs font-medium text-gray-600">Tipo de movimentação<select value={movementForm.kind} onChange={(e) => setMovementForm({ ...movementForm, kind: e.target.value as MovementKind, destination: '', serials: '' })} className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm"><option value="baixa">Baixa de estoque</option><option value="transferencia">Transferência de posição</option></select></label>
          <label className="block text-xs font-medium text-gray-600">Posição · lote · SKU · saldo<select required value={movementForm.entryId} onChange={(e) => setMovementForm({ ...movementForm, entryId: e.target.value, serials: '', quantity: '1' })} className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm"><option value="">Selecione um saldo conferido</option>{data.entries.filter((entry) => entry.quantity != null && entry.quantity > 0).map((entry) => <option key={entry.id} value={entry.id}>{entry.location} · {entry.lot} · {entry.itemCode} {entry.itemName} · {formatQuantity(entry.quantity!, entry.unit)}</option>)}</select></label>
          {selectedEntry && movementForm.kind === 'baixa' && (selectedEntry.serialized ? <label className="block text-xs font-medium text-gray-600">Números de série<textarea required rows={3} value={movementForm.serials} onChange={(e) => setMovementForm({ ...movementForm, serials: e.target.value })} placeholder="Seriais que sairão do estoque" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 font-mono text-sm" /><span className="mt-1 block font-normal text-gray-400">Disponíveis: {selectedEntry.serials.join(', ')}</span></label> : <label className="block text-xs font-medium text-gray-600">Quantidade para baixa (saldo: {formatQuantity(selectedEntry.quantity!, selectedEntry.unit)})<input required type="number" min="0.001" max={selectedEntry.quantity!} step={selectedEntry.unit === 'MT' ? '0.001' : '1'} value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label>)}
          {selectedEntry && movementForm.kind === 'transferencia' && <><label className="block text-xs font-medium text-gray-600">Nova posição<input required value={movementForm.destination} onChange={(e) => setMovementForm({ ...movementForm, destination: e.target.value })} placeholder="A004000110" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 font-mono text-sm" /></label><p className="rounded bg-blue-50 p-2.5 text-xs text-blue-900">A transferência move a linha inteira para preservar a quantidade de caixas e a rastreabilidade do lote: {formatQuantity(selectedEntry.quantity!, selectedEntry.unit)}.</p></>}
          <label className="block text-xs font-medium text-gray-600">Pedido, OS ou motivo<input required value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} placeholder="Ex.: OP-2026-0042" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" /></label>
          <button type="submit" disabled={!selectedEntry} className="inline-flex items-center gap-2 rounded bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">{movementForm.kind === 'baixa' ? <><ClipboardMinus className="h-3.5 w-3.5" />Registrar baixa</> : <><ArrowLeftRight className="h-3.5 w-3.5" />Transferir posição</>}</button>
        </form>
      </div>

      {notice && <div role="status" className="border-l-4 border-blue-600 bg-blue-50 px-3 py-2 text-xs text-blue-900">{notice}</div>}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-500" /><h2 className="text-sm font-semibold text-slate-900">Saldo por posição</h2></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b border-gray-100 bg-slate-50 text-gray-500"><th className="px-4 py-2 font-medium">Endereço</th><th className="px-4 py-2 text-right font-medium">Registros</th><th className="px-4 py-2 text-right font-medium">Caixas</th><th className="px-4 py-2 text-right font-medium">Saldo UN</th><th className="px-4 py-2 text-right font-medium">Saldo MT</th><th className="px-4 py-2 text-right font-medium">A conferir</th></tr></thead><tbody className="divide-y divide-gray-50">{positions.map(([location, summary]) => <tr key={location}><td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{location}</td><td className="px-4 py-2.5 text-right">{summary.rows}</td><td className="px-4 py-2.5 text-right">{summary.boxes}</td><td className="px-4 py-2.5 text-right">{formatQuantity(summary.units, 'UN')}</td><td className="px-4 py-2.5 text-right">{formatQuantity(summary.meters, 'MT')}</td><td className="px-4 py-2.5 text-right">{summary.pending || '—'}</td></tr>)}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3"><div className="flex items-center gap-2"><Boxes className="h-4 w-4 text-gray-500" /><h2 className="text-sm font-semibold text-slate-900">Estoque por lote e endereço</h2></div><div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Posição, SKU, item ou lote" className="w-full rounded border border-gray-300 py-1.5 pl-8 pr-2 text-xs" /></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead><tr className="border-b border-gray-100 bg-slate-50 text-gray-500"><th className="px-3 py-2 font-medium">Posição</th><th className="px-3 py-2 font-medium">SKU / Item</th><th className="px-3 py-2 font-medium">Lote</th><th className="px-3 py-2 text-right font-medium">Caixas</th><th className="px-3 py-2 text-right font-medium">Saldo</th><th className="px-3 py-2 font-medium">Status / recebimento</th><th className="px-3 py-2 font-medium">Ação</th></tr></thead>
          <tbody className="divide-y divide-gray-50">{filteredEntries.map((entry) => <tr key={entry.id} className="align-top hover:bg-slate-50"><td className="px-3 py-2.5 font-mono font-semibold text-slate-700">{entry.location}</td><td className="px-3 py-2.5"><div className="font-semibold text-slate-800">{entry.itemName}</div><div className="text-gray-400">SKU {entry.itemCode}</div>{entry.serialized && <div className="mt-1 text-[11px] text-blue-700">Serializado · {entry.serials.length} disponível(is)</div>}</td><td className="px-3 py-2.5 font-mono text-slate-700">{entry.lot}</td><td className="px-3 py-2.5 text-right">{entry.boxCount}</td><td className="px-3 py-2.5 text-right font-semibold">{entry.quantity == null ? <span className="text-amber-700">Conferir: {entry.rawQuantity}</span> : formatQuantity(entry.quantity, entry.unit)}</td><td className="px-3 py-2.5"><div>{entry.status}</div>{(entry.supplier || entry.invoiceNumber || entry.receivedDate) && <div className="mt-1 text-gray-400">{[entry.supplier, entry.invoiceNumber && `NF ${entry.invoiceNumber}`, entry.receivedDate].filter(Boolean).join(' · ')}</div>}{entry.quantity == null && <div className="mt-1 text-amber-700">Bloqueado para movimentação até conferência</div>}</td><td className="px-3 py-2.5">{entry.quantity == null ? <form onSubmit={(event) => resolveQuantity(event, entry)} className="flex items-center gap-1"><input name="quantity" required type="number" min="0.001" step={entry.unit === 'MT' ? '0.001' : '1'} placeholder={`Qtd ${entry.unit}`} className="w-24 rounded border border-gray-300 px-2 py-1" /><button className="rounded bg-amber-600 px-2 py-1 font-semibold text-white hover:bg-amber-700">Conferir</button></form> : entry.unit === 'UN' && !entry.serialized ? serialEntryId === entry.id ? <form onSubmit={(event) => registerExistingSerials(event, entry.id)} className="min-w-56 space-y-1"><textarea required rows={3} value={serialInput} onChange={(event) => setSerialInput(event.target.value)} placeholder={`Informe ${entry.quantity} seriais`} className="w-full rounded border border-gray-300 px-2 py-1 font-mono" /><div className="flex gap-1"><button className="rounded bg-blue-700 px-2 py-1 font-semibold text-white">Vincular ({parseSerials(serialInput).length}/{entry.quantity})</button><button type="button" onClick={() => { setSerialEntryId(''); setSerialInput(''); }} className="rounded border border-gray-300 px-2 py-1">Cancelar</button></div></form> : <button type="button" onClick={() => { setSerialEntryId(entry.id); setSerialInput(''); }} className="rounded border border-blue-200 px-2 py-1 font-medium text-blue-700 hover:bg-blue-50">Vincular seriais</button> : <span className="text-blue-700">Rastreado por serial</span>}</td></tr>)}
          {filteredEntries.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>}</tbody>
        </table></div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3"><Barcode className="h-4 w-4 text-gray-500" /><h2 className="text-sm font-semibold text-slate-900">Histórico de movimentações</h2></div>
        {data.movements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs"><thead><tr className="border-b border-gray-100 bg-slate-50 text-gray-500"><th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Movimento</th><th className="px-3 py-2 font-medium">SKU / Item</th><th className="px-3 py-2 font-medium">Lote</th><th className="px-3 py-2 font-medium">Origem</th><th className="px-3 py-2 font-medium">Destino / saldo</th><th className="px-3 py-2 text-right font-medium">Quantidade</th><th className="px-3 py-2 font-medium">Referência / seriais</th></tr></thead><tbody className="divide-y divide-gray-50">{data.movements.map((movement) => <tr key={movement.id}><td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{new Date(movement.date).toLocaleString('pt-BR')}</td><td className="px-3 py-2.5">{movement.kind === 'saida_producao' ? 'Saída da produção' : movement.kind === 'baixa' ? 'Baixa' : 'Transferência'}</td><td className="px-3 py-2.5">{movement.itemCode} · {movement.itemName}</td><td className="px-3 py-2.5 font-mono">{movement.lot}</td><td className="px-3 py-2.5 font-mono">{movement.locationFrom || '—'}</td><td className="px-3 py-2.5 font-mono">{movement.kind === 'transferencia' ? movement.locationTo : movement.kind === 'saida_producao' ? 'PRODUÇÃO' : '—'}</td><td className="px-3 py-2.5 text-right font-semibold">{formatQuantity(movement.quantity, movement.unit)}</td><td className="px-3 py-2.5">{movement.productionOrderCode || movement.reference}{movement.wallBarcode && <div className="font-mono text-gray-400">Parede: {movement.wallBarcode}</div>}{movement.serials.length > 0 && <div className="font-mono text-gray-400">{movement.serials.join(', ')}</div>}</td></tr>)}</tbody></table></div> : <p className="px-4 py-5 text-xs text-gray-500">As entradas, baixas e transferências aparecerão aqui.</p>}
      </section>
      </>}
    </div>
  );
}