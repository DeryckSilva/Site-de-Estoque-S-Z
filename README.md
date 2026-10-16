import React, { useState, useMemo } from 'react';
import {
  LayoutGrid,
  Package,
  Layers,
  Factory,
  FileText,
  ClipboardList,
  BarChart3,
  Warehouse,
  Tag,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Home,
  Menu,
  ShoppingBag,
  Layers3,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  Clock,
  ExternalLink,
  Boxes,
  Barcode,
  Plus,
  Trash2,
} from 'lucide-react';
import { ProductionMappingTab } from './components/mapping/ProductionMappingTab';
import { ProductionOrdersTab } from './components/production/ProductionOrdersTab';
import { AttendedOrdersTable } from './components/production/AttendedOrdersTable';
import { WarehouseWmsTab } from './components/inventory/WarehouseWmsTab';
import { EQUIPMENT_ITEMS } from './data/initialData';

// ---------- Mock data (Base do Site) ----------

interface FamilyData {
  name: string;
  items: number;
  value: number;
  pct: number;
  units: number;
  unit: string;
}

interface BaseItemData {
  id: number;
  name: string;
  code: string;
  tipo: string;
  familia: string;
  saldo: number;
  unit: string;
  minimo: number;
  consumoDia: number;
  dura: string;
  entrega: string;
  comprar: number | null;
  situacao: 'ok' | 'abaixo' | 'rompe';
  custoMedio: number | null;
  valorEstoque: number;
  consumo90: number;
  zonas: number;
  cobertura: string;
  prazoEntrega?: string | number | null;
}

interface CatalogItem extends BaseItemData {
  fornecedor: string;
  unidade: string;
  vinculo: 'Pendente de vínculo' | 'Vinculado';
}

const FAMILIES: FamilyData[] = [
  { name: 'Iscas', items: 8, value: 1464829.79, pct: 94.09, units: 11066, unit: 'UN' },
  { name: 'Rastreadores', items: 9, value: 40396.42, pct: 2.59, units: 259, unit: 'UN' },
  { name: 'Chips', items: 5, value: 15384.92, pct: 0.99, units: 2448, unit: 'UN' },
  { name: 'Tubo Termo', items: 8, value: 11347.47, pct: 0.73, units: 1201.45, unit: 'MT' },
  { name: 'Carregadores', items: 3, value: 6175.0, pct: 0.4, units: 410, unit: 'UN' },
  { name: 'Produtos Acabados', items: 3, value: 5900.5, pct: 0.38, units: 30, unit: 'UN' },
  { name: 'Web Tags', items: 2, value: 5245.0, pct: 0.34, units: 62, unit: 'UN' },
  { name: 'Ímã', items: 2, value: 3829.21, pct: 0.25, units: 434, unit: 'UN' },
  { name: 'Kraft', items: 9, value: 1938.35, pct: 0.12, units: 2411, unit: 'UN' },
  { name: 'Caixas', items: 8, value: 1604.28, pct: 0.1, units: 775, unit: 'UN' },
  { name: 'Complementos', items: 3, value: 157.35, pct: 0.01, units: 24, unit: 'UN' },
  { name: 'Baterias', items: 1, value: 0, pct: 0, units: 0, unit: 'UN' },
];

const ITEMS: BaseItemData[] = [
  {
    id: 1,
    name: 'Montagem — Iscas',
    code: 'PA-ISCAS',
    tipo: 'Produto acabado',
    familia: 'Produtos Acabados',
    saldo: 30,
    unit: 'UN',
    minimo: 0,
    consumoDia: 2.59,
    dura: '11 dias',
    entrega: '—',
    comprar: null,
    situacao: 'ok',
    custoMedio: null,
    valorEstoque: 0,
    consumo90: 78,
    zonas: 1,
    cobertura: '11 dias',
  },
  {
    id: 2,
    name: 'ST - 410G (2G)',
    code: 'IST410G-2G',
    tipo: 'Equipamento',
    familia: 'Iscas',
    saldo: 0,
    unit: 'UN',
    minimo: 1500,
    consumoDia: 0,
    dura: 'sem consumo',
    entrega: '—',
    comprar: 1500,
    situacao: 'abaixo',
    custoMedio: null,
    valorEstoque: 0,
    consumo90: 0,
    zonas: 0,
    cobertura: 'sem consumo no período',
    prazoEntrega: null,
  },
  {
    id: 3,
    name: 'Montagem — Web Tags',
    code: 'PA-WEB-TAGS',
    tipo: 'Produto acabado',
    familia: 'Produtos Acabados',
    saldo: 0,
    unit: 'UN',
    minimo: 0,
    consumoDia: 0,
    dura: 'sem consumo',
    entrega: '—',
    comprar: null,
    situacao: 'ok',
    custoMedio: null,
    valorEstoque: 0,
    consumo90: 0,
    zonas: 0,
    cobertura: 'sem consumo no período',
  },
  {
    id: 4,
    name: 'ST - 4410G (4G)',
    code: 'IST4410G-4G',
    tipo: 'Equipamento',
    familia: 'Iscas',
    saldo: 2,
    unit: 'UN',
    minimo: 1500,
    consumoDia: 0,
    dura: 'sem consumo',
    entrega: '—',
    comprar: 1498,
    situacao: 'abaixo',
    custoMedio: null,
    valorEstoque: 0,
    consumo90: 0,
    zonas: 1,
    cobertura: 'sem consumo no período',
    prazoEntrega: null,
  },
  {
    id: 5,
    name: 'CHIP - TIM',
    code: 'CHP-TIM',
    tipo: 'SIM card',
    familia: 'Chips',
    saldo: 0,
    unit: 'UN',
    minimo: 200,
    consumoDia: 0,
    dura: 'sem consumo',
    entrega: '—',
    comprar: 200,
    situacao: 'abaixo',
    custoMedio: null,
    valorEstoque: 0,
    consumo90: 0,
    zonas: 0,
    cobertura: 'sem consumo no período',
    prazoEntrega: null,
  },
  {
    id: 6,
    name: 'Montagem — Rastreadores',
    code: 'PA-RASTREADORES',
    tipo: 'Produto acabado',
    familia: 'Produtos Acabados',
    saldo: 0,
    unit: 'UN',
    minimo: 0,
    consumoDia: 0,
    dura: 'sem consumo',
    entrega: '1 d',
    comprar: null,
    situacao: 'ok',
    custoMedio: null,
    valorEstoque: 0,
    consumo90: 0,
    zonas: 0,
    cobertura: 'sem consumo no período',
  },
  {
    id: 7,
    name: 'KRAFT | SEM EURO',
    code: 'KRF-SEURO',
    tipo: 'Insumo',
    familia: 'Kraft',
    saldo: 321,
    unit: 'UN',
    minimo: 200,
    consumoDia: 0,
    dura: 'sem consumo',
    entrega: '—',
    comprar: null,
    situacao: 'ok',
    custoMedio: 4.12,
    valorEstoque: 1322.52,
    consumo90: 0,
    zonas: 1,
    cobertura: 'sem consumo no período',
  },
];

const TABS = [
  { id: 'mapping', label: 'Mapeamento Online (Produção)', icon: FileSpreadsheet, isNew: true },
  { id: 'overview', label: 'Visão geral e valoração', icon: BarChart3 },
  { id: 'zone', label: 'Estoque por zona', icon: Warehouse },
  { id: 'cost', label: 'Custo', icon: Tag },
  { id: 'manage', label: 'Gerenciar estoque', icon: Layers3 },
];

const NAV_GROUPS = [
  {
    label: 'ESTOQUE',
    items: [
      { id: 'mapeamento_producao', label: 'Mapeamento de Produção', icon: LayoutGrid },
      { id: 'wms', label: 'WMS · PLP e serializados', icon: Barcode },
    ],
  },
  {
    label: 'PRODUÇÃO',
    items: [
      { id: 'ordens_producao', label: 'Ordens de Produção', icon: Factory },
      { id: 'baixas_producao', label: 'Pedidos atendidos', icon: FileSpreadsheet },
      { id: 'saida_producao', label: 'Saída da Produção', icon: Barcode },
    ],
  },
  {
    label: 'CADASTROS',
    items: [{ id: 'itens', label: 'Itens', icon: FileText }],
  },
];

const WINDOWS = ['30 d', '90 d', '180 d', '365 d'];

const fmtBRL = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtUnit = (v: number | null, unit: string) =>
  v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit}`;

// ---------- Small building blocks ----------

function Badge({ situacao }: { situacao: 'ok' | 'abaixo' | 'rompe' }) {
  const map = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    abaixo: 'bg-amber-50 text-amber-700 border-amber-200',
    rompe: 'bg-red-50 text-red-700 border-red-200',
  };
  const text = { ok: 'OK', abaixo: 'Abaixo do mínimo', rompe: 'Rompe no prazo' }[situacao];
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${map[situacao]}`}
    >
      {text}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'red' | 'amber';
}) {
  const toneClass = {
    default: 'text-slate-900',
    red: 'text-red-600',
    amber: 'text-amber-600',
  }[tone];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function BarRow({
  name,
  itemsCount,
  pct,
  unitLabel,
  maxPct,
}: {
  name: string;
  itemsCount: number;
  value?: number;
  pct: number;
  unitLabel: string;
  maxPct: number;
}) {
  const width = maxPct > 0 ? Math.max((pct / maxPct) * 100, 2) : 0;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="truncate text-sm text-slate-800">{name}</span>
          <span className="shrink-0 text-xs text-gray-400">{itemsCount} item(ns)</span>
        </div>
        <div className="shrink-0 text-sm text-slate-700 whitespace-nowrap">{unitLabel}</div>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

// ---------- Overview tab ----------

function OverviewTab() {
  const totalValue = FAMILIES.reduce((s, f) => s + f.value, 0);
  const maxPct = Math.max(...FAMILIES.map((f) => f.pct));
  const attention = ITEMS.filter((i) => i.situacao !== 'ok');

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Valor por família</div>
        <div className="text-xs text-gray-400">
          Soma de saldo × custo médio · {FAMILIES.length} família(s)
        </div>
        <div className="mt-2 divide-y divide-gray-50">
          {FAMILIES.map((f) => (
            <BarRow
              key={f.name}
              name={f.name}
              itemsCount={f.items}
              pct={f.pct}
              maxPct={maxPct}
              unitLabel={`${fmtBRL(f.value)} ${f.pct.toFixed(2)}%`}
            />
          ))}
        </div>
        <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
          Total posicionado: {fmtBRL(totalValue)}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Quantidade por família</div>
        <div className="text-xs text-gray-400">
          Separado por unidade de medida — não se somam · {FAMILIES.length} família(s)
        </div>
        <div className="mt-2 divide-y divide-gray-50">
          {FAMILIES.map((f) => (
            <BarRow
              key={f.name}
              name={f.name}
              itemsCount={f.items}
              pct={f.pct}
              maxPct={maxPct}
              unitLabel={fmtUnit(f.units, f.unit)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-900">Cobertura de saldo</div>
          <Layers3 className="h-4 w-4 text-gray-300" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-slate-900">56</span>
          <span className="text-sm text-gray-400">/ 61 ativos com saldo</span>
        </div>
        <div className="text-xs text-gray-400">5 zerado(s) · 2 com estoque mínimo definido</div>
        <div className="mt-3 space-y-2">
          {ITEMS.filter((i) => i.minimo > 0 || i.situacao !== 'ok')
            .slice(0, 5)
            .map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0 truncate">
                  <span className="text-gray-400">{i.code}</span>{' '}
                  <span className="text-slate-800">{i.name}</span>{' '}
                  <span className="text-gray-400">· {i.familia}</span>
                </div>
                <span className="shrink-0 rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
                  {i.minimo > 0 ? `min. ${i.minimo.toLocaleString('pt-BR')} UN` : 'sem mínimo'}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div className="text-sm font-medium text-amber-900">Atenção requerida</div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-900">Abaixo do mínimo</span>
            <span className="font-semibold text-amber-700">{attention.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-900">Ficha incompleta</span>
            <span className="font-semibold text-amber-700">0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Manage tab ----------

function ManageTab() {
  const [windowSel, setWindowSel] = useState('90 d');
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(2);
  const [edits, setEdits] = useState<Record<number, { minimo?: number; prazo?: string | number }>>({});

  const filtered = useMemo(() => {
    return ITEMS.filter((i) => {
      if (onlyAttention && i.situacao === 'ok') return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !i.name.toLowerCase().includes(q) &&
          !i.code.toLowerCase().includes(q) &&
          !i.familia.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [onlyAttention, query]);

  const abaixoMinimo = ITEMS.filter((i) => i.situacao === 'abaixo');
  const rompem = ITEMS.filter((i) => i.situacao === 'rompe');
  const aComprarValor = abaixoMinimo.reduce((s, i) => s + (i.comprar || 0) * 25.7, 0);

  const setEdit = (id: number, field: 'minimo' | 'prazo', value: any) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 mr-1">Janela do consumo</span>
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindowSel(w)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                windowSel === w
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {w}
            </button>
          ))}
          <button
            onClick={() => setOnlyAttention((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              onlyAttention
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Só o que precisa de atenção
          </button>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          <ShoppingBag className="h-4 w-4" />
          Requisitar compra ({abaixoMinimo.length} item(ns))
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Rompem no prazo" value={rompem.length} sub="o saldo acaba antes da entrega" tone="red" />
        <StatCard label="Abaixo do mínimo" value={abaixoMinimo.length} tone="amber" />
        <StatCard label="A comprar" value={abaixoMinimo.length} sub={`${fmtBRL(aComprarValor)} estimados`} />
      </div>

      <div className="mt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código, nome ou família"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="w-8 py-2 pl-3"></th>
              <th className="py-2 pr-3 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2 text-right font-medium">Mínimo</th>
              <th className="px-3 py-2 text-right font-medium">Consumo/dia</th>
              <th className="px-3 py-2 text-right font-medium">Dura</th>
              <th className="px-3 py-2 text-right font-medium">Entrega</th>
              <th className="px-3 py-2 text-right font-medium">Comprar</th>
              <th className="px-3 py-2 pr-4 text-right font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const isOpen = expandedId === i.id;
              const edit = edits[i.id] || {};
              const minimo = edit.minimo ?? i.minimo;
              const prazo = edit.prazo ?? i.prazoEntrega ?? '';
              return (
                <React.Fragment key={i.id}>
                  <tr
                    onClick={() => setExpandedId(isOpen ? null : i.id)}
                    className={`cursor-pointer border-b border-gray-50 hover:bg-gray-50 ${
                      i.situacao === 'abaixo' ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="py-2.5 pl-3 text-gray-400">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-800">{i.name}</div>
                      <div className="text-xs text-gray-400">
                        {i.code} · {i.familia}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {i.saldo.toLocaleString('pt-BR')} {i.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {minimo ? minimo.toLocaleString('pt-BR') : 0}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{i.consumoDia || 0}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{i.dura}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{i.entrega}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {i.comprar ? i.comprar.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Badge situacao={i.situacao} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
                          <div>
                            <div className="text-xs text-gray-400">Item</div>
                            <div className="text-slate-800">{i.name}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Código</div>
                            <div className="text-slate-800">{i.code}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Tipo</div>
                            <div className="text-slate-800">{i.tipo}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Família</div>
                            <div className="text-slate-800">{i.familia}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Saldo</div>
                            <div className="text-slate-800">
                              {i.saldo} {i.unit}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Em quantas zonas</div>
                            <div className="text-slate-800">{i.zonas}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Custo médio</div>
                            <div className="text-slate-800">{fmtBRL(i.custoMedio)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Valor em estoque</div>
                            <div className="text-slate-800">{fmtBRL(i.valorEstoque)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Consumo em {windowSel}</div>
                            <div className="text-slate-800">{i.consumo90}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Consumo por dia</div>
                            <div className="text-slate-800">{i.consumoDia || 0}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Cobertura</div>
                            <div className="text-slate-800">{i.cobertura}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Prazo de entrega</div>
                            <div className="text-slate-800">{i.prazoEntrega || 'não informado'}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-200 pt-4">
                          <div>
                            <label className="text-xs font-medium text-gray-500">Estoque mínimo</label>
                            <input
                              type="number"
                              value={minimo}
                              onChange={(e) => setEdit(i.id, 'minimo', Number(e.target.value))}
                              className="mt-1 block w-32 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Prazo de entrega (dias)</label>
                            <input
                              type="number"
                              value={prazo}
                              onChange={(e) => setEdit(i.id, 'prazo', e.target.value)}
                              className="mt-1 block w-40 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
                            />
                          </div>
                          <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                            Salvar parâmetros
                          </button>
                          {i.comprar ? (
                            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-gray-50">
                              <ShoppingBag className="h-3.5 w-3.5" />
                              Requisitar {i.comprar.toLocaleString('pt-BR')} {i.unit}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs leading-relaxed text-gray-400">
        A cobertura é saldo ÷ consumo médio diário na janela escolhida — não é o giro contábil.
        A sugestão de compra é (mínimo + consumo durante o prazo de entrega) − saldo: compra só o
        que falta para o mínimo deixar o estoque furado durante toda a espera do fornecedor.
      </div>
    </div>
  );
}

function ZoneTab() {
  const zones = [
    { name: 'Galpão A — Prateleira 01', items: 18, value: 812340.2 },
    { name: 'Galpão A — Prateleira 02', items: 14, value: 401220.0 },
    { name: 'Câmara Fria', items: 6, value: 158900.5 },
    { name: 'Expedição', items: 9, value: 96340.1 },
    { name: 'Externo — Fornecedor Parceiro', items: 4, value: 38350.3 },
  ];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-slate-900">Saldo por zona</div>
      <div className="text-xs text-gray-400">Onde o estoque está fisicamente posicionado</div>
      <div className="mt-3 divide-y divide-gray-50">
        {zones.map((z) => (
          <div key={z.name} className="flex items-center justify-between py-2.5 text-sm">
            <div className="flex items-center gap-2 text-slate-800">
              <Warehouse className="h-4 w-4 text-gray-300" />
              {z.name}
            </div>
            <div className="text-right">
              <div className="text-slate-800">{fmtBRL(z.value)}</div>
              <div className="text-xs text-gray-400">{z.items} item(ns)</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostTab() {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="py-2 pl-3 pr-3 font-medium">Item</th>
            <th className="px-3 py-2 text-right font-medium">Saldo</th>
            <th className="px-3 py-2 text-right font-medium">Custo médio</th>
            <th className="px-3 py-2 pr-4 text-right font-medium">Valor em estoque</th>
          </tr>
        </thead>
        <tbody>
          {ITEMS.map((i) => (
            <tr key={i.id} className="border-b border-gray-50">
              <td className="py-2.5 pl-3 pr-3">
                <div className="font-medium text-slate-800">{i.name}</div>
                <div className="text-xs text-gray-400">{i.code}</div>
              </td>
              <td className="px-3 py-2.5 text-right text-slate-700">
                {i.saldo.toLocaleString('pt-BR')} {i.unit}
              </td>
              <td className="px-3 py-2.5 text-right text-slate-700">{fmtBRL(i.custoMedio)}</td>
              <td className="px-3 py-2.5 pr-4 text-right text-slate-700">{fmtBRL(i.valorEstoque)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Complementary simple views for sidebar items ----------

function DashboardPanelTab({ onNavigate }: { onNavigate: (viewId: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => onNavigate('ordens_producao')}
          className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Ordens a Atender</span>
            <Factory className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">5</div>
          <div className="mt-1 text-xs text-emerald-600 flex items-center gap-1 font-medium">
            <span>OP-2026-0042 no topo</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('mapeamento_producao')}
          className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Mapeamento Online</span>
            <LayoutGrid className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">22 Modelos</div>
          <div className="mt-1 text-xs text-gray-400">ISCA 2G/4G, Tags e Rastreadores</div>
        </div>

        <div
          onClick={() => onNavigate('posicao_estoque')}
          className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Valor em Estoque</span>
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">R$ 1.551.423,76</div>
          <div className="mt-1 text-xs text-gray-400">12 famílias monitoradas</div>
        </div>

        <div
          onClick={() => onNavigate('suprimentos')}
          className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Abaixo do Mínimo</span>
            <Package className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">3 Itens</div>
          <div className="mt-1 text-xs text-gray-400">Comprar sugerido calculado</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-slate-900">Ordens de Produção Prioritárias</h3>
            <button
              onClick={() => onNavigate('ordens_producao')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Ver todas <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-3 divide-y divide-gray-100 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900">OP-2026-0042</span>
                <span className="text-gray-400 ml-2">PV-2026-0011 · ST - 4410G (4G)</span>
              </div>
              <span className="rounded bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 border border-emerald-200">
                185 destinados
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900">OP-2026-0041</span>
                <span className="text-gray-400 ml-2">PV-2026-0010 · ST - 410G (2G)</span>
              </div>
              <span className="text-gray-500 font-medium">Falta: 10 UN</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900">OP-2026-0040</span>
                <span className="text-gray-400 ml-2">PV-2026-0009 · TAG MINI CARD</span>
              </div>
              <span className="text-gray-500 font-medium">Falta: 1 UN</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-slate-900">Acesso Rápido ao Mapeamento</h3>
            <button
              onClick={() => onNavigate('mapeamento_producao')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Abrir planilha <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 leading-relaxed">
            O Mapeamento de Produção sincroniza diretamente as entregas e pedidos com o estoque físico, calculando automaticamente as disponibilidades para a equipe técnica.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onNavigate('mapeamento_producao')}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
            >
              Mapeamento Online
            </button>
            <button
              onClick={() => onNavigate('ordens_producao')}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-50 shadow-xs"
            >
              Ordens de Produção
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuprimentosTab() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-base font-bold text-slate-900">Módulo de Suprimentos</h2>
          <p className="text-xs text-gray-500">Pedidos de compra e requisições para produção</p>
        </div>
        <button className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-800">
          Novo Pedido de Compra
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <div className="text-xs font-semibold text-amber-800">Necessidade de Compra</div>
          <div className="text-xl font-bold text-amber-900 mt-1">3.198 UN</div>
          <div className="text-[11px] text-amber-700">Calculado para manter estoque mínimo</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <div className="text-xs font-semibold text-blue-800">Ordens de Compra em Aberto</div>
          <div className="text-xl font-bold text-blue-900 mt-1">4 ordens</div>
          <div className="text-[11px] text-blue-700">Previsão de entrega: 5 a 12 dias</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="text-xs font-semibold text-emerald-800">Recebidos no Mês</div>
          <div className="text-xl font-bold text-emerald-900 mt-1">12.450 UN</div>
          <div className="text-[11px] text-emerald-700">Conferidos e estocados</div>
        </div>
      </div>
    </div>
  );
}

function CadastrosItensTab() {
  const storageKey = 'kiraso_catalog_items_v1';
  const initialItems: CatalogItem[] = (() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const savedItems = saved ? JSON.parse(saved) as CatalogItem[] : [];
      const mappingItems: CatalogItem[] = EQUIPMENT_ITEMS.map((item, index) => ({
        id: index + 1,
        name: item.name,
        code: item.id.toUpperCase(),
        tipo: item.group === 'INDISPONÍVEL' ? 'Componente' : 'Equipamento',
        familia: item.group,
        saldo: 0,
        unit: item.unit || 'UN',
        unidade: item.unit || 'UN',
        minimo: 0,
        consumoDia: 0,
        dura: 'sem consumo',
        entrega: '—',
        comprar: null,
        situacao: 'ok' as const,
        custoMedio: null,
        valorEstoque: 0,
        consumo90: 0,
        zonas: 0,
        cobertura: 'sem consumo no período',
        fornecedor: '',
        vinculo: 'Vinculado' as const,
      }));
      const mappingIds = new Set(mappingItems.map((item) => item.code));
      const customItems = savedItems.filter((item) => item.id > 1000000000 && !mappingIds.has(item.code));
      return [...mappingItems, ...customItems];
    } catch { /* use the seed catalog */ }
    return EQUIPMENT_ITEMS.map((item, index) => ({
      id: index + 1,
      name: item.name,
      code: item.id.toUpperCase(),
      tipo: item.group === 'INDISPONÍVEL' ? 'Componente' : 'Equipamento',
      familia: item.group,
      saldo: 0,
      unit: item.unit || 'UN',
      unidade: item.unit || 'UN',
      minimo: 0,
      consumoDia: 0,
      dura: 'sem consumo',
      entrega: '—',
      comprar: null,
      situacao: 'ok' as const,
      custoMedio: null,
      valorEstoque: 0,
      consumo90: 0,
      zonas: 0,
      cobertura: 'sem consumo no período',
      fornecedor: '',
      vinculo: 'Vinculado' as const,
    }));
  })();
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', fornecedor: '', familia: 'Iscas', tipo: 'Insumo', unidade: 'UN', minimo: 0, custoMedio: 0 });

  const persist = (next: CatalogItem[]) => {
    setItems(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('kiraso_catalog_sync'));
  };
  const updateItem = (id: number, updates: Partial<CatalogItem>) => persist(items.map((item) => item.id === id ? { ...item, ...updates } : item));
  const addItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    const id = Date.now();
    persist([...items, {
      id, name: form.name.trim(), code: form.code.trim(), tipo: form.tipo, familia: form.familia,
      saldo: 0, unit: form.unidade, unidade: form.unidade, minimo: Number(form.minimo) || 0,
      consumoDia: 0, dura: 'sem consumo', entrega: '—', comprar: null, situacao: 'ok',
      custoMedio: Number(form.custoMedio) || 0, valorEstoque: 0, consumo90: 0, zonas: 0,
      cobertura: 'sem consumo no período', fornecedor: form.fornecedor.trim(), vinculo: 'Pendente de vínculo',
    }]);
    setForm({ name: '', code: '', fornecedor: '', familia: 'Iscas', tipo: 'Insumo', unidade: 'UN', minimo: 0, custoMedio: 0 });
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
        <div><h2 className="text-base font-bold text-slate-900">Cadastro de Itens</h2><p className="text-xs text-gray-500">Cadastre fornecedores, materiais e produtos. Itens novos ficam pendentes de vínculo no Mapeamento.</p></div>
        <button type="button" onClick={() => setIsAdding((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><Plus className="h-3.5 w-3.5" /> {isAdding ? 'Fechar' : 'Novo item'}</button>
      </div>
      {isAdding && <form onSubmit={addItem} className="grid grid-cols-1 gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <input required placeholder="Descrição do item *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-2" />
        <input required placeholder="Código / SKU *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-2" />
        <input placeholder="Fornecedor" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-2" />
        <select value={form.familia} onChange={(e) => setForm({ ...form, familia: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-2"><option>Iscas</option><option>Rastreadores</option><option>Tags</option><option>Componentes</option><option>Produtos Acabados</option><option>Outros</option></select>
        <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-2"><option>Insumo</option><option>Equipamento</option><option>Produto acabado</option><option>Componente</option></select>
        <select value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-2"><option>UN</option><option>MT</option><option>KG</option><option>CX</option></select>
        <input type="number" min="0" placeholder="Estoque mínimo" value={form.minimo} onChange={(e) => setForm({ ...form, minimo: Number(e.target.value) })} className="rounded border border-slate-300 bg-white px-2 py-2" />
        <button type="submit" className="rounded bg-emerald-700 px-3 py-2 font-semibold text-white hover:bg-emerald-800">Salvar e enviar para vínculo</button>
      </form>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs"><table className="w-full min-w-[1100px] text-left text-xs"><thead><tr className="border-b border-gray-200 bg-slate-50 text-[10px] font-semibold uppercase text-gray-500"><th className="px-3 py-2">Código</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Família</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Un.</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-right">Mínimo</th><th className="px-3 py-2">Vínculo</th><th className="w-10 px-2" /></tr></thead><tbody className="divide-y divide-gray-100">{items.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-3 py-2"><input value={item.code} onChange={(e) => updateItem(item.id, { code: e.target.value })} className="w-28 rounded border border-transparent bg-transparent px-1 py-1 font-mono font-semibold hover:border-blue-300 focus:border-blue-500" /></td><td className="px-3 py-2"><input value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} className="w-48 rounded border border-transparent bg-transparent px-1 py-1 font-medium hover:border-blue-300 focus:border-blue-500" /></td><td className="px-3 py-2"><input value={item.fornecedor} onChange={(e) => updateItem(item.id, { fornecedor: e.target.value })} placeholder="Não informado" className="w-40 rounded border border-transparent bg-transparent px-1 py-1 hover:border-blue-300 focus:border-blue-500" /></td><td className="px-3 py-2"><select value={item.familia} onChange={(e) => updateItem(item.id, { familia: e.target.value })} className="rounded border border-transparent bg-transparent px-1 py-1"><option>Iscas</option><option>Rastreadores</option><option>Tags</option><option>Componentes</option><option>Produtos Acabados</option><option>Outros</option></select></td><td className="px-3 py-2"><select value={item.tipo} onChange={(e) => updateItem(item.id, { tipo: e.target.value })} className="rounded border border-transparent bg-transparent px-1 py-1"><option>Insumo</option><option>Equipamento</option><option>Produto acabado</option><option>Componente</option></select></td><td className="px-3 py-2"><input value={item.unidade} onChange={(e) => updateItem(item.id, { unidade: e.target.value, unit: e.target.value })} className="w-12 rounded border border-transparent bg-transparent px-1 py-1 text-center hover:border-blue-300" /></td><td className="px-3 py-2 text-right"><input type="number" value={item.saldo} onChange={(e) => updateItem(item.id, { saldo: Number(e.target.value) })} className="w-20 rounded border border-transparent bg-transparent px-1 py-1 text-right hover:border-blue-300" /></td><td className="px-3 py-2 text-right"><input type="number" value={item.minimo} onChange={(e) => updateItem(item.id, { minimo: Number(e.target.value) })} className="w-20 rounded border border-transparent bg-transparent px-1 py-1 text-right hover:border-blue-300" /></td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.vinculo === 'Vinculado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{item.vinculo}</span></td><td className="px-2 py-2"><button type="button" title="Excluir item" onClick={() => persist(items.filter((current) => current.id !== item.id))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table></div>
    </div>
  );
}

function RelatoriosTab() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
      <div className="pb-3 border-b border-gray-100">
        <h2 className="text-base font-bold text-slate-900">Relatórios Gerenciais</h2>
        <p className="text-xs text-gray-500">Exportações de produção, movimentações e histórico</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-gray-200 p-4 hover:border-blue-400 cursor-pointer transition-all">
          <div className="font-bold text-slate-900">Relatório de Atendimento de OPs</div>
          <p className="text-gray-500 mt-1">Tempo médio de bancada, lotes entregues e gargalos.</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 hover:border-blue-400 cursor-pointer transition-all">
          <div className="font-bold text-slate-900">Posição de Saldos e Valoração</div>
          <p className="text-gray-500 mt-1">Curva ABC e estoque financeiro por família.</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 hover:border-blue-400 cursor-pointer transition-all">
          <div className="font-bold text-slate-900">Rastreabilidade de Seriais e IMEIs</div>
          <p className="text-gray-500 mt-1">Histórico completo de equipamentos montados.</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Sidebar matching image ----------

function Sidebar({
  open,
  currentView,
  onSelectView,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentView: string;
  onSelectView: (viewId: string) => void;
}) {
  return (
    <aside
      className={`${
        open ? 'w-56' : 'w-0 lg:w-16'
      } shrink-0 overflow-hidden bg-[#0d1627] transition-all duration-200 flex flex-col z-20 border-r border-slate-800/80`}
    >
      {/* Brand identity */}
      <div className="flex h-16 items-center px-4">
        {open ? (
          <div className="flex items-center gap-2 text-white select-none">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 shadow-sm">
              <Boxes className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-bold leading-tight tracking-tight">Produção &amp;<br />Logística S&amp;Z</span>
          </div>
        ) : (
          <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-white"><Boxes className="h-4 w-4" /></span>
        )}
      </div>

      <nav className="mt-1 space-y-4 px-2 pb-6 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {open && (
              <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400/90 select-none">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectView(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-all ${
                      isActive
                        ? 'bg-[#1e293b] text-white font-semibold shadow-xs border border-slate-700/50'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                    title={item.label}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-300" />
                    {open && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

// ---------- App ----------

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Default to the requested view from user screenshot: 'ordens_producao'
  const [currentView, setCurrentView] = useState<string>('ordens_producao');
  // Secondary tab for Posicao de Estoque
  const [stockTab, setStockTab] = useState('manage');

  // Breadcrumb text based on active view
  const getBreadcrumb = () => {
    switch (currentView) {
      case 'ordens_producao':
        return 'Ordens de Produção';
      case 'baixas_producao':
        return 'Pedidos atendidos';
      case 'saida_producao':
        return 'Saída da Produção';
      case 'mapeamento_producao':
        return 'Mapeamento de Produção';
      case 'posicao_estoque':
        return 'Posição de Estoque';
      case 'wms':
        return 'WMS · PLP e serializados';
      case 'painel':
        return 'Painel';
      case 'suprimentos':
        return 'Suprimentos';
      case 'itens':
        return 'Itens';
      case 'relatorios':
        return 'Relatórios';
      default:
        return 'Ordens de Produção';
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        currentView={currentView}
        onSelectView={setCurrentView}
      />

      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        {/* Top App Header with exact breadcrumb as in image */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200/80 bg-white px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-white shadow-sm">
              <Boxes className="h-3.5 w-3.5" />
            </span>
            <span className="hidden text-xs font-bold text-slate-800 sm:inline">Produção &amp; Logística S&amp;Z</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-slate-700 mr-1"
              title="Recolher / Expandir Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span>Produção e Logística</span>
            <ChevronRight className="h-3 w-3 text-gray-300" />
            <span className="font-semibold text-slate-800">{getBreadcrumb()}</span>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-[1700px]">
            {/* View 1: Ordens de Produção (Strictly modeled from image) */}
            {currentView === 'ordens_producao' && (
              <ProductionOrdersTab onNavigateToMapping={() => setCurrentView('mapeamento_producao')} />
            )}

            {/* View 1.1: Planilha de Baixas (Pedidos Atendidos e Finalizados) */}
            {currentView === 'baixas_producao' && (
              <div className="space-y-4">
                <AttendedOrdersTable
                  onNavigateToProductionQueue={() => setCurrentView('ordens_producao')}
                  onNavigateToMapping={() => setCurrentView('mapeamento_producao')}
                />
              </div>
            )}

            {currentView === 'saida_producao' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
                    <Barcode className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">Saída da Produção</h1>
                    <p className="text-xs text-gray-500">Bipagem de LPN e baixa de materiais diretamente do WMS.</p>
                  </div>
                </div>
                <WarehouseWmsTab initialView="production" />
              </div>
            )}

            {/* View 2: Mapeamento de Produção (Online spreadsheet) */}
            {currentView === 'mapeamento_producao' && (
              <div className="space-y-4">
                <ProductionMappingTab onNavigateToProduction={() => setCurrentView('ordens_producao')} />
              </div>
            )}

            {currentView === 'wms' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
                    <Barcode className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">WMS</h1>
                    <p className="text-xs text-gray-500">Controle de PLPs, caixas, quantidades e equipamentos serializados.</p>
                  </div>
                </div>
                <WarehouseWmsTab />
              </div>
            )}

            {/* View 3: Posição de Estoque */}
            {currentView === 'posicao_estoque' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-xs">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">Posição de Estoque</h1>
                    <p className="text-xs text-gray-500">
                      Quanto tem, quanto vale e em que zona está — visões consolidadas.
                    </p>
                  </div>
                </div>

                {/* Subtabs for Posicao de Estoque */}
                <div className="flex gap-1 overflow-x-auto border-b border-gray-200 mb-4">
                  {[
                    { id: 'manage', label: 'Gerenciar estoque', icon: Layers3 },
                    { id: 'overview', label: 'Visão geral e valoração', icon: BarChart3 },
                    { id: 'zone', label: 'Estoque por zona', icon: Warehouse },
                    { id: 'cost', label: 'Custo', icon: Tag },
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = stockTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setStockTab(t.id)}
                        className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
                          active
                            ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-slate-800 hover:bg-gray-100/50'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {stockTab === 'manage' && <ManageTab />}
                {stockTab === 'overview' && <OverviewTab />}
                {stockTab === 'zone' && <ZoneTab />}
                {stockTab === 'cost' && <CostTab />}
              </div>
            )}

            {/* View 4: Painel */}
            {currentView === 'painel' && <DashboardPanelTab onNavigate={setCurrentView} />}

            {/* View 5: Suprimentos */}
            {currentView === 'suprimentos' && <SuprimentosTab />}

            {/* View 6: Itens */}
            {currentView === 'itens' && <CadastrosItensTab />}

            {/* View 7: Relatórios */}
            {currentView === 'relatorios' && <RelatoriosTab />}
          </div>
        </main>
      </div>
    </div>
  );
}

