import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, LoaderCircle } from 'lucide-react';
import { listProductionEquipmentSwaps } from '../../services/productionSeparationService';
import type { ProductionEquipmentSwap } from '../../types/productionSeparation';
import { downloadEquipmentSwapHistoryExcel } from '../../utils/productionSeparationExcel';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível carregar o histórico de trocas.';
}

function isComponentFilter(value: string): value is 'all' | 'serial' | 'ccid' {
  return value === 'all' || value === 'serial' || value === 'ccid';
}

export function ProductionEquipmentSwapHistoryPanel() {
  const [swaps, setSwaps] = useState<ProductionEquipmentSwap[]>([]);
  const [orderFilter, setOrderFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState<'all' | 'serial' | 'ccid'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    listProductionEquipmentSwaps()
      .then((result) => {
        if (active) setSwaps(result);
      })
      .catch((error) => {
        console.error('Falha ao carregar o histórico de trocas:', error);
        if (active) setErrorMessage(errorText(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredSwaps = useMemo(() => {
    const orderQuery = normalize(orderFilter);
    const clientQuery = normalize(clientFilter);
    return swaps.filter((swap) =>
      (!orderQuery || normalize(swap.orderNumber).includes(orderQuery)) &&
      (!clientQuery || normalize(swap.clientName).includes(clientQuery)) &&
      (componentFilter === 'all' || swap.component === componentFilter) &&
      (!startDate || swap.swappedOn >= startDate) &&
      (!endDate || swap.swappedOn <= endDate)
    );
  }, [swaps, orderFilter, clientFilter, componentFilter, startDate, endDate]);

  async function handleExport() {
    setExporting(true);
    setErrorMessage('');
    try {
      await downloadEquipmentSwapHistoryExcel(filteredSwaps);
    } catch (error) {
      console.error('Falha ao exportar o histórico de trocas:', error);
      setErrorMessage(`Não foi possível baixar o Excel. ${errorText(error)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Histórico de trocas</h2>
          <p className="text-sm text-slate-600">Cada registro preserva o valor antigo e o novo Serial ou Chip/CCID.</p>
        </div>
        <button
          type="button"
          disabled={loading || exporting || filteredSwaps.length === 0}
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? 'Gerando Excel...' : 'Baixar Excel'}
        </button>
      </header>

      <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-medium text-slate-600">
          Nº do pedido
          <input value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Cliente
          <input value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Tipo de troca
          <select value={componentFilter} onChange={(event) => { if (isComponentFilter(event.target.value)) setComponentFilter(event.target.value); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900">
            <option value="all">Todos</option>
            <option value="serial">Serial</option>
            <option value="ccid">Chip / CCID</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          De
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Até
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" />
        </label>
      </div>

      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold text-slate-700">
            <tr>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Equipamento</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Valor antigo</th>
              <th className="px-3 py-2">Valor novo</th>
              <th className="px-3 py-2">Responsável</th>
              <th className="px-3 py-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Carregando histórico...</td></tr>
            ) : filteredSwaps.length ? filteredSwaps.map((swap) => (
              <tr key={swap.id} className="border-t border-slate-200">
                <td className="px-3 py-2 font-medium text-slate-900">{swap.orderNumber}</td>
                <td className="px-3 py-2">{swap.clientName || '—'}</td>
                <td className="px-3 py-2">{swap.equipmentType || '—'}</td>
                <td className="px-3 py-2">{swap.component === 'serial' ? 'Serial' : 'Chip / CCID'}</td>
                <td className="px-3 py-2 font-mono">{swap.previousValue}</td>
                <td className="px-3 py-2 font-mono">{swap.newValue}</td>
                <td className="px-3 py-2">{swap.responsible || '—'}</td>
                <td className="px-3 py-2">{swap.swappedOn.split('-').reverse().join('/')}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                  {swaps.length ? 'Nenhuma troca corresponde aos filtros.' : 'Ainda não há trocas registradas.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && <p className="text-xs text-slate-500">{filteredSwaps.length} de {swaps.length} trocas</p>}
    </section>
  );
}
