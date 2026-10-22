import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  CheckCircle2,
  Package,
  Layers,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { AttendedOrder } from '../../types/attendedOrders';
import { getAttendedOrders, getAttendedStats } from '../../services/attendedOrdersService';
import { FinalizeBaixaModal } from './FinalizeBaixaModal';

interface AttendedOrdersTableProps {
  onNavigateToProductionQueue?: () => void;
  onNavigateToMapping?: () => void;
}

export function AttendedOrdersTable({
  onNavigateToProductionQueue,
  onNavigateToMapping,
}: AttendedOrdersTableProps) {
  const [orders, setOrders] = useState<AttendedOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLinha, setSelectedLinha] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedIscaLigada, setSelectedIscaLigada] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Load orders and listen to sync events
  const loadData = () => {
    const data = getAttendedOrders();
    setOrders(data);
  };

  useEffect(() => {
    loadData();

    const handleSync = () => {
      loadData();
    };

    window.addEventListener('kiraso_attended_sync', handleSync);
    window.addEventListener('kiraso_orders_sync', handleSync);

    return () => {
      window.removeEventListener('kiraso_attended_sync', handleSync);
      window.removeEventListener('kiraso_orders_sync', handleSync);
    };
  }, []);

  // Compute summary stats
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalQtd = orders.reduce((acc, o) => acc + (Number(o.quantidade) || 0), 0);
    const totalLigadas = orders.filter((o) => (o.contemIscaLigada || '').toUpperCase() === 'SIM').length;
    const totalCarregadores = orders.reduce((acc, o) => {
      const q = Number(o.quantidadeCarregador);
      return acc + (isNaN(q) ? (o.carregador === 'SIM' ? 1 : 0) : q);
    }, 0);
    return { totalOrders, totalQtd, totalLigadas, totalCarregadores };
  }, [orders]);

  // Months available
  const availableMonths = [
    'Setembro',
    'Agosto',
    'Julho',
    'Junho',
    'Maio',
    'Abril',
    'Março',
    'Fevereiro',
    'Janeiro',
  ];

  // Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Linha filter
      if (selectedLinha !== 'all' && o.linhaProducao !== selectedLinha) {
        return false;
      }

      // Month filter
      if (selectedMonth !== 'all') {
        const ad = (o.adicionadoEm || '').toUpperCase();
        const monthUpper = selectedMonth.toUpperCase();
        const isMatch =
          ad.includes(monthUpper) ||
          (monthUpper === 'SETEMBRO' && (ad.includes('SEP') || ad.includes('SET')));
        if (!isMatch) return false;
      }

      // Isca ligada filter
      if (selectedIscaLigada !== 'all') {
        const lig = (o.contemIscaLigada || '').toUpperCase();
        if (selectedIscaLigada === 'SIM' && lig !== 'SIM') return false;
        if (selectedIscaLigada === 'NÃO' && lig === 'SIM') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (o.numPedido || '').toLowerCase().includes(q) ||
          (o.cliente || '').toLowerCase().includes(q) ||
          (o.comercial || '').toLowerCase().includes(q) ||
          (o.geracao || '').toLowerCase().includes(q) ||
          (o.modelo || '').toLowerCase().includes(q) ||
          (o.linhaProducao || '').toLowerCase().includes(q) ||
          (o.idIscaLigada || '').toLowerCase().includes(q) ||
          (o.medidaCaixa || '').toLowerCase().includes(q) ||
          (o.observacao || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [orders, selectedLinha, selectedMonth, selectedIscaLigada, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Adicionado às',
      'Endereço IP',
      'LINHA DE PRODUÇÃO',
      'CLIENTE',
      'COMERCIAL',
      'CONTRATO',
      'OPERADORA',
      'GERAÇÃO',
      'MODELO',
      'QUANTIDADE',
      'MEDIDA DA CAIXA',
      'OBSERVAÇÃO',
      'CONTÉM ISCA LIGADA ?',
      'ID DA ISCA LIGADA',
      'N° DO PEDIDO',
      'CARREGADOR',
      'QUANTIDADE CARREGADOR',
    ];

    const rows = filteredOrders.map((o) => [
      `"${o.adicionadoEm}"`,
      `"${o.enderecoIp || ''}"`,
      `"${o.linhaProducao}"`,
      `"${(o.cliente || '').replace(/"/g, '""')}"`,
      `"${o.comercial}"`,
      `"${o.contrato}"`,
      `"${o.operadora}"`,
      `"${o.geracao}"`,
      `"${o.modelo}"`,
      o.quantidade,
      `"${o.medidaCaixa}"`,
      `"${(o.observacao || '').replace(/"/g, '""')}"`,
      `"${o.contemIscaLigada}"`,
      `"${o.idIscaLigada || ''}"`,
      `"${o.numPedido}"`,
      `"${o.carregador || ''}"`,
      `"${o.quantidadeCarregador || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `planilha_baixas_kiraso_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Modal for manual / new Baixa */}
      <FinalizeBaixaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Top Banner with Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Pedidos Baixados</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.totalOrders}</div>
          <span className="text-[11px] text-emerald-700 font-medium">Cadastrados no histórico</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Peças Expedidas</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats.totalQtd.toLocaleString('pt-BR')} <span className="text-xs font-medium text-gray-400">UN</span>
          </div>
          <span className="text-[11px] text-blue-700 font-medium">Produzidas & Baixadas</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Iscas Ligadas Testadas</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.totalLigadas}</div>
          <span className="text-[11px] text-amber-700 font-medium">Com ID rastreável na expedição</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Carregadores Enviados</span>
            <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.totalCarregadores} UN</div>
          <span className="text-[11px] text-purple-700 font-medium">Acompanham os lotes</span>
        </div>
      </div>

      {/* Control Bar: Search, Filters, New Baixa Button, Export */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Pedido, Cliente, Comercial, Modelo, IDs..."
              className="w-full rounded-lg border border-gray-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-gray-400 outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Baixa no Pedido</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-gray-50 shadow-xs transition-colors"
              title="Exportar planilha filtrada em CSV"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Exportar Planilha</span>
            </button>

            {onNavigateToProductionQueue && (
              <button
                onClick={onNavigateToProductionQueue}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 shadow-xs transition-colors"
              >
                <span>Fila "A atender"</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
          {/* Linha Filter */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 font-medium mr-1 text-[11px]">Linha:</span>
            {['all', 'LINHA S-01', 'LINHA S-02', 'LABORATÓRIO', 'LOGISTICA'].map((lp) => (
              <button
                key={lp}
                onClick={() => setSelectedLinha(lp)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  selectedLinha === lp
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lp === 'all' ? 'Todas as Linhas' : lp}
              </button>
            ))}
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-gray-400 font-medium text-[11px]">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">Todos os Meses</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <span className="text-gray-400 font-medium text-[11px] ml-2">Isca Ligada:</span>
            <select
              value={selectedIscaLigada}
              onChange={(e) => setSelectedIscaLigada(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">Todas</option>
              <option value="SIM">Com Isca Ligada (SIM)</option>
              <option value="NÃO">Sem Isca Ligada (NÃO)</option>
            </select>
          </div>
        </div>
      </div>

      {/* The Main Attended Orders Spreadsheet */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-gray-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Planilha de Pedidos Atendidos & Baixas Realizadas
            </h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
              {filteredOrders.length} registros
            </span>
          </div>
          <div className="text-[11px] text-gray-500">
            Atualizada em tempo real com as baixas da produção e pedidos da base
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-gray-200 bg-slate-100/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 pl-3 pr-2 w-8"></th>
                <th className="py-2.5 px-3">Adicionado às</th>
                <th className="py-2.5 px-3">Linha</th>
                <th className="py-2.5 px-3">N° do Pedido</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Comercial</th>
                <th className="py-2.5 px-3">Contrato / Op</th>
                <th className="py-2.5 px-3">Geração / Modelo</th>
                <th className="py-2.5 px-3 text-center">Qtd</th>
                <th className="py-2.5 px-3">Medida Caixa</th>
                <th className="py-2.5 px-3 text-center">Isca Ligada?</th>
                <th className="py-2.5 px-3">Carregador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400">
                    Nenhum pedido atendido encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((row) => {
                  const isExpanded = expandedRowId === row.id;
                  const hasLigada = (row.contemIscaLigada || '').toUpperCase() === 'SIM';
                  const hasCarregador = (row.carregador || '').toUpperCase() === 'SIM';

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          hasLigada ? 'bg-emerald-50/10' : ''
                        }`}
                        onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                      >
                        <td className="py-2.5 pl-3 pr-1 text-gray-400">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </td>

                        {/* Adicionado às */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {row.adicionadoEm}
                        </td>

                        {/* Linha de Produção */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              row.linhaProducao === 'LINHA S-01'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : row.linhaProducao === 'LINHA S-02'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : row.linhaProducao === 'LABORATÓRIO'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {row.linhaProducao}
                          </span>
                        </td>

                        {/* N° do Pedido */}
                        <td className="py-2.5 px-3 font-mono font-bold text-red-700 whitespace-nowrap">
                          {row.numPedido}
                        </td>

                        {/* Cliente */}
                        <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[240px] truncate" title={row.cliente}>
                          {row.cliente}
                        </td>

                        {/* Comercial */}
                        <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                          {row.comercial}
                        </td>

                        {/* Contrato / Operadora */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-slate-800 font-medium block">{row.operadora}</span>
                          <span className="text-[10px] text-gray-400">{row.contrato}</span>
                        </td>

                        {/* Geração / Modelo */}
                        <td className="py-2.5 px-3 max-w-[200px] truncate" title={`${row.geracao} - ${row.modelo}`}>
                          <span className="font-semibold text-slate-800 block text-[11px]">{row.geracao}</span>
                          <span className="text-[10px] text-gray-500">{row.modelo}</span>
                        </td>

                        {/* Quantidade */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {row.quantidade}
                          </span>
                        </td>

                        {/* Medida Caixa */}
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600 whitespace-nowrap">
                          {row.medidaCaixa}
                        </td>

                        {/* Isca Ligada */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {hasLigada ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300 shadow-2xs">
                              <Zap className="h-3 w-3 fill-emerald-700" />
                              <span>SIM</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px] font-medium">NÃO</span>
                          )}
                        </td>

                        {/* Carregador */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {hasCarregador ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                              SIM ({row.quantidadeCarregador || 1})
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded row with full details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-gray-200">
                          <td colSpan={12} className="py-3 px-8 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 py-1">
                              <div>
                                <span className="font-semibold text-gray-500 block">ID da Isca Ligada / Seriais:</span>
                                <span className="font-mono text-emerald-800 font-bold break-all">
                                  {row.idIscaLigada || 'Nenhum ID especificado'}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-500 block">Endereço IP de Registro:</span>
                                <span className="font-mono text-slate-600">{row.enderecoIp || 'Local'}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-500 block">Observações do Pedido:</span>
                                <span className="text-slate-700">{row.observacao || 'Sem observações'}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-500 block">Status na Fila:</span>
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Baixa efetuada / Atendido
                                </span>
                              </div>
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
    </div>
  );
}
