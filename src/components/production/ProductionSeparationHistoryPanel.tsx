import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Download, LoaderCircle } from 'lucide-react';
import { listCompletedProductionSeparations } from '../../services/productionSeparationService';
import type { CompletedProductionSeparation, SeparatedEquipment } from '../../types/productionSeparation';
import { downloadSeparationHistoryExcel } from '../../utils/productionSeparationExcel';

const UNIT_COLUMNS: Array<{ key: keyof SeparatedEquipment; label: string }> = [
  { key: 'equipmentType', label: 'Equipamento' },
  { key: 'serialNumber', label: 'Serial' },
  { key: 'ccid', label: 'CCID / chip' },
  { key: 'terminalColor', label: 'Cor termo' },
  { key: 'terminalSize', label: 'Tam. termo' },
  { key: 'terminalDiameter', label: 'Diâmetro' },
  { key: 'terminalQuantity', label: 'Qtd. termo' },
  { key: 'batteryType', label: 'Bateria' },
  { key: 'kraftBoxType', label: 'Cx. Kraft' },
  { key: 'kraftQuantity', label: 'Qtd. Kraft' },
  { key: 'box3dType', label: 'Cx. 3D' },
  { key: 'box3dQuantity', label: 'Qtd. 3D' },
  { key: 'magnetType', label: 'Ímã' },
  { key: 'magnetQuantity', label: 'Qtd. ímã' },
  { key: 'productionDeliveryDate', label: 'Data' },
  { key: 'productionResponsible', label: 'Responsável' },
];

function localDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível carregar o histórico.';
}

export function ProductionSeparationHistoryPanel() {
  const [records, setRecords] = useState<CompletedProductionSeparation[]>([]);
  const [orderFilter, setOrderFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    listCompletedProductionSeparations()
      .then((result) => {
        if (active) setRecords(result);
      })
      .catch((error) => {
        console.error('Falha ao carregar o histórico de separações:', error);
        if (active) setErrorMessage(errorText(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const orderQuery = normalize(orderFilter);
    const clientQuery = normalize(clientFilter);
    return records.filter((record) => {
      const day = localDateKey(record.finalizedAt);
      return (!orderQuery || normalize(record.orderNumber).includes(orderQuery)) &&
        (!clientQuery || normalize(record.clientName).includes(clientQuery)) &&
        (!startDate || day >= startDate) &&
        (!endDate || day <= endDate);
    });
  }, [records, orderFilter, clientFilter, startDate, endDate]);

  async function handleExport() {
    setExporting(true);
    setErrorMessage('');
    try {
      await downloadSeparationHistoryExcel(filteredRecords);
    } catch (error) {
      console.error('Falha ao exportar o histórico de separações:', error);
      setErrorMessage(`Não foi possível baixar o Excel. ${errorText(error)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Histórico de separações concluídas</h2>
          <p className="text-sm text-slate-600">As sequências finalizadas ficam arquivadas sem alterar os seriais ou chips registrados.</p>
        </div>
        <button
          type="button"
          disabled={loading || exporting || filteredRecords.length === 0}
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? 'Gerando Excel...' : 'Baixar Excel'}
        </button>
      </header>

      <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-600">
          Nº do pedido
          <input value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Cliente
          <input value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Concluída a partir de
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Concluída até
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
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold text-slate-700">
            <tr>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Concluída em</th>
              <th className="px-3 py-2">Unidades</th>
              <th className="px-3 py-2">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Carregando histórico...</td></tr>
            ) : filteredRecords.length ? filteredRecords.map((record) => {
              const isExpanded = expandedId === record.id;
              return (
                <FragmentHistoryRow
                  key={record.id}
                  record={record}
                  expanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : record.id)}
                />
              );
            }) : (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  {records.length ? 'Nenhuma separação corresponde aos filtros.' : 'Ainda não há separações concluídas.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && <p className="text-xs text-slate-500">{filteredRecords.length} de {records.length} separações</p>}
    </section>
  );
}

function FragmentHistoryRow({
  record,
  expanded,
  onToggle,
}: {
  record: CompletedProductionSeparation;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-slate-200">
        <td className="px-3 py-2 font-medium text-slate-900">{record.orderNumber}</td>
        <td className="px-3 py-2 text-slate-700">{record.clientName || '—'}</td>
        <td className="px-3 py-2 text-slate-700">{formatDateTime(record.finalizedAt)}</td>
        <td className="px-3 py-2 text-slate-700">{record.data.equipment.length}</td>
        <td className="px-3 py-2">
          <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {expanded ? 'Ocultar' : 'Ver unidades'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={5} className="p-3">
            <div className="overflow-x-auto">
              <table className="min-w-[1800px] border-collapse text-left text-xs">
                <thead className="bg-slate-200 text-slate-700">
                  <tr>
                    <th className="px-2 py-2">Unidade</th>
                    {UNIT_COLUMNS.map((column) => <th key={column.key} className="px-2 py-2">{column.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {record.data.equipment.map((unit, index) => (
                    <tr key={unit.id} className="border-t border-slate-200 bg-white">
                      <td className="px-2 py-1.5">{index + 1}</td>
                      {UNIT_COLUMNS.map((column) => (
                        <td key={column.key} className="px-2 py-1.5">{String(unit[column.key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
