import React, { useState } from 'react';
import { CalculatedItemRow, GroupSummary, MappingCustomColumn, MappingLayoutColumn } from '../../types/mapping';
import { GripVertical, Info, Plus, Trash2 } from 'lucide-react';

interface TopInventoryTableProps {
  rows: CalculatedItemRow[];
  groupSummaries: Record<string, GroupSummary>;
  painelAbertos: { iscas2G: number; iscas4G: number; tags: number; rastreadores: number };
  onStockChange: (itemId: string, field: 'fisico' | 'quantidade' | 'emManutencao' | 'compraRealizada', value: number) => void;
  onItemNameChange: (itemId: string, name: string) => void;
  layoutColumns: MappingLayoutColumn[];
  customColumns: MappingCustomColumn[];
  customColumnValues: Record<string, Record<string, number>>;
  onMoveItem: (itemId: string, targetColumnId: string) => void;
  onAddLayoutColumn: (title: string) => void;
  onDeleteLayoutColumn: (columnId: string) => void;
  onAddCustomColumn: (title: string) => void;
  onCustomValueChange: (columnId: string, itemId: string, value: number) => void;
  onAddItem: (name: string, targetColumnId: string) => void;
}

export const TopInventoryTable: React.FC<TopInventoryTableProps> = ({
  rows, groupSummaries, painelAbertos, onStockChange, onItemNameChange,
  layoutColumns, customColumns, customColumnValues, onMoveItem,
  onAddLayoutColumn, onDeleteLayoutColumn, onAddCustomColumn, onCustomValueChange,
  onAddItem,
}) => {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemGroup, setNewItemGroup] = useState(layoutColumns[0]?.id || '');
  const [newWindowName, setNewWindowName] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const rowById = new Map(rows.map((row) => [row.item.id, row]));

  const numberInput = (itemId: string, field: 'fisico' | 'quantidade' | 'emManutencao' | 'compraRealizada', value: number, onChange = onStockChange) => (
    <input
      type="number"
      value={value}
      onChange={(event) => onChange(itemId, field, Number(event.target.value) || 0)}
      className="w-full rounded border border-transparent bg-amber-50/40 px-1 py-1 text-center font-mono text-xs font-semibold outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white"
    />
  );

  const totalFor = (columnRows: CalculatedItemRow[]): GroupSummary => columnRows.reduce((sum, row) => ({
    group: row.item.group,
    title: `TOTAL ${row.item.group}`,
    fisico: sum.fisico + row.fisico,
    comPedido: sum.comPedido + row.comPedido,
    semPedido: sum.semPedido + row.semPedido,
    saldoReal: sum.saldoReal + row.saldoReal,
    emManutencao: sum.emManutencao + row.emManutencao,
    compraRealizada: sum.compraRealizada + row.compraRealizada,
    saldoPosEntrega: sum.saldoPosEntrega + row.saldoPosEntrega,
  }), { group: columnRows[0]?.item.group || 'ISCA 2G', title: 'TOTAL', fisico: 0, comPedido: 0, semPedido: 0, saldoReal: 0, emManutencao: 0, compraRealizada: 0, saldoPosEntrega: 0 });

  const renderRow = (row: CalculatedItemRow, isUnavailable: boolean) => {
    const realNegative = row.saldoReal < 0;
    const afterNegative = row.saldoPosEntrega < 0;
    return (
      <tr key={row.item.id} draggable onDragStart={() => setDraggedItemId(row.item.id)} onDragEnd={() => setDraggedItemId(null)} className={`border-b border-slate-200 text-xs hover:bg-blue-50/40 ${isUnavailable ? 'bg-red-50/30' : 'bg-white'}`}>
        <td className="sticky left-0 z-10 w-6 border-r border-slate-200 bg-white px-1"><GripVertical className="mx-auto h-3.5 w-3.5 cursor-grab text-slate-300" /></td>
        <td className="sticky left-6 z-10 min-w-[170px] border-r border-slate-200 bg-white px-1 py-0.5"><input value={row.item.name} onChange={(event) => onItemNameChange(row.item.id, event.target.value)} className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-medium outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white" /></td>
        <td className="w-20 border-r border-slate-200 px-1">{numberInput(row.item.id, 'fisico', row.fisico)}</td>
        <td className="w-24 border-r border-slate-200 text-center font-mono text-blue-800">{row.comPedido}</td>
        <td className="w-24 border-r border-slate-200 text-center font-mono text-purple-800">{row.semPedido}</td>
        <td className={`w-24 border-r border-slate-200 text-center font-mono font-bold ${realNegative ? 'bg-red-100 text-red-700' : 'bg-emerald-50/50 text-emerald-800'}`}>{row.saldoReal}</td>
        <td className="w-24 border-r border-slate-200 px-1">{numberInput(row.item.id, 'emManutencao', row.emManutencao)}</td>
        <td className="w-24 border-r border-slate-200 px-1">{numberInput(row.item.id, 'compraRealizada', row.compraRealizada)}</td>
        <td className={`w-28 border-r border-slate-200 text-center font-mono font-bold ${afterNegative ? 'bg-red-100 text-red-700' : 'bg-blue-50/60 text-blue-900'}`}>{row.saldoPosEntrega}</td>
        {customColumns.map((column) => <td key={column.id} className="w-24 border-r border-slate-200 px-1">{numberInput(row.item.id, 'quantidade', customColumnValues[column.id]?.[row.item.id] || 0, (itemId, _field, value) => onCustomValueChange(column.id, itemId, value))}</td>)}
        <td className="w-7 px-1 text-center"><GripVertical className="mx-auto h-3.5 w-3.5 text-slate-300" /></td>
      </tr>
    );
  };

  const renderTotal = (summary: GroupSummary) => (
    <tr className="border-b-2 border-slate-300 bg-blue-100/70 text-xs font-bold text-slate-800">
      <td colSpan={2} className="px-3 py-1.5 uppercase">{summary.title}</td>
      <td className="text-center font-mono">{summary.fisico}</td><td className="text-center font-mono text-blue-900">{summary.comPedido}</td><td className="text-center font-mono text-purple-900">{summary.semPedido}</td><td className="text-center font-mono">{summary.saldoReal}</td><td className="text-center font-mono">{summary.emManutencao}</td><td className="text-center font-mono">{summary.compraRealizada}</td><td className="text-center font-mono">{summary.saldoPosEntrega}</td>
      {customColumns.map((column) => <td key={column.id} />)}<td />
    </tr>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-amber-300 bg-amber-100" /> Campos amarelos são editáveis diretamente.</span><span className="flex items-center gap-1"><Info className="h-3.5 w-3.5 text-blue-500" /> Saldo Real = Físico − Com pedido − Sem pedido</span></div>
      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm">
        <table className="min-w-[1160px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-[#0e2a47] text-[11px] font-semibold uppercase tracking-wide text-white">
              <th rowSpan={2} className="sticky left-0 z-30 w-6 border-r border-slate-500 bg-[#0e2a47]" /><th rowSpan={2} className="sticky left-6 z-30 min-w-[170px] border-r border-slate-500 bg-[#0e2a47] px-3 py-2 text-left">Modelo / Equipamento</th><th className="border-r border-slate-500 bg-[#12365c] px-2 py-1.5 text-center">Saldo</th><th colSpan={2} className="border-r border-slate-500 bg-[#164270] px-2 py-1.5 text-center">Comprometidas</th><th className="border-r border-slate-500 bg-[#1a4e84] px-2 py-1.5 text-center">Saldo Disponível</th><th colSpan={2} className="border-r border-slate-500 bg-[#164270] px-2 py-1.5 text-center">Externo / Entrega Prevista</th><th rowSpan={2} className="border-r border-slate-500 bg-[#0e2a47] px-2 py-2 text-center">Saldo pós Entrega</th>{customColumns.map((column) => <th key={column.id} rowSpan={2} className="border-r border-slate-500 bg-[#0b3b5c] px-2 py-2 text-center">{column.title}</th>)}<th rowSpan={2} className="w-7 bg-[#0e2a47]" />
            </tr>
            <tr className="bg-[#12365c] text-[11px] font-medium text-white"><th className="border-r border-slate-500 bg-amber-950/40 px-2 py-1.5 text-center text-amber-200">Físico</th><th className="border-r border-slate-500 px-2 py-1.5 text-center">Com pedido</th><th className="border-r border-slate-500 px-2 py-1.5 text-center">Sem pedido</th><th className="border-r border-slate-500 px-2 py-1.5 text-center">Saldo Real</th><th className="border-r border-slate-500 bg-amber-950/40 px-2 py-1.5 text-center text-amber-200">Em manutenção</th><th className="border-r border-slate-500 bg-amber-950/40 px-2 py-1.5 text-center text-amber-200">Compra realizada</th></tr>
          </thead>
          {layoutColumns.map((column) => { const columnRows = column.itemIds.map((id) => rowById.get(id)).filter((row): row is CalculatedItemRow => Boolean(row)); return <tbody key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedItemId) onMoveItem(draggedItemId, column.id); setDraggedItemId(null); }}><tr className={`${column.group === 'INDISPONÍVEL' ? 'bg-red-700' : 'bg-[#062c63]'} text-xs font-bold uppercase tracking-wide text-white`}><td colSpan={10 + customColumns.length} className="px-3 py-1.5">{column.title}<span className="ml-2 rounded bg-white/20 px-1.5 text-[10px]">{columnRows.length}</span>{!column.locked && <button type="button" onClick={() => onDeleteLayoutColumn(column.id)} className="float-right"><Trash2 className="h-3.5 w-3.5" /></button>}</td></tr>{columnRows.map((row) => renderRow(row, column.group === 'INDISPONÍVEL'))}{columnRows.length > 0 && renderTotal(totalFor(columnRows))}</tbody>; })}
        </table>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-300 bg-slate-50 p-2">
          <form onSubmit={(event) => { event.preventDefault(); if (newItemName.trim()) { onAddItem(newItemName.trim(), newItemGroup); setNewItemName(''); } }} className="flex min-w-[360px] flex-1 gap-1"><input value={newItemName} onChange={(event) => setNewItemName(event.target.value)} placeholder="Novo item (modelo)" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs" /><select value={newItemGroup} onChange={(event) => setNewItemGroup(event.target.value)} className="rounded border border-slate-300 px-2 text-xs">{layoutColumns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select><button type="submit" className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Item</button></form>
          <form onSubmit={(event) => { event.preventDefault(); if (newColumnName.trim()) { onAddCustomColumn(newColumnName.trim()); setNewColumnName(''); } }} className="flex gap-1"><input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="Nova coluna (ex: Retornos)" className="w-44 rounded border border-slate-300 px-2 py-1.5 text-xs" /><button type="submit" className="rounded bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">+ Coluna</button></form>
          <form onSubmit={(event) => { event.preventDefault(); if (newWindowName.trim()) { onAddLayoutColumn(newWindowName.trim()); setNewWindowName(''); } }} className="flex gap-1"><input value={newWindowName} onChange={(event) => setNewWindowName(event.target.value)} placeholder="Nova janela" className="w-32 rounded border border-slate-300 px-2 py-1.5 text-xs" /><button type="submit" className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">+ Janela</button></form>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-500"><span>Arraste pelo ícone para outra janela.</span><span>Edite nomes e números diretamente nas células.</span><span>As alterações ficam salvas automaticamente.</span></div>
      <div className="hidden">{groupSummaries && painelAbertos ? ' ' : null}</div>
    </div>
  );
};
