import React, { useState } from 'react';
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { CalculatedItemRow } from '../../types/mapping';

export interface MappingLayoutColumn {
  id: string;
  title: string;
  itemIds: string[];
  locked?: boolean;
}

interface MappingLayoutEditorProps {
  rows: CalculatedItemRow[];
  columns: MappingLayoutColumn[];
  onMoveItem: (itemId: string, columnId: string) => void;
  onRenameItem: (itemId: string, name: string) => void;
  onAddColumn: (title: string) => void;
  onDeleteColumn: (columnId: string) => void;
}

export const MappingLayoutEditor: React.FC<MappingLayoutEditorProps> = ({
  rows,
  columns,
  onMoveItem,
  onRenameItem,
  onAddColumn,
  onDeleteColumn,
}) => {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const rowById = new Map(rows.map((row) => [row.item.id, row]));

  const saveItemName = () => {
    if (editingItemId && editingName.trim()) onRenameItem(editingItemId, editingName.trim());
    setEditingItemId(null);
  };

  const addColumn = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newColumnName.trim()) return;
    onAddColumn(newColumnName.trim());
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 shadow-sm" aria-label="Editor visual do mapeamento">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Editor visual do mapeamento</h2>
            <span className="rounded bg-blue-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Arraste e organize</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600">Mova equipamentos entre janelas, crie novas colunas e altere os nomes sem perder os cálculos da planilha.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddingColumn((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm transition hover:bg-blue-50"
        >
          {isAddingColumn ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {isAddingColumn ? 'Cancelar' : 'Nova janela / coluna'}
        </button>
      </div>

      {isAddingColumn && (
        <form onSubmit={addColumn} className="mb-3 flex max-w-md gap-2 rounded-lg border border-blue-200 bg-white p-2">
          <input
            autoFocus
            value={newColumnName}
            onChange={(event) => setNewColumnName(event.target.value)}
            placeholder="Nome da nova coluna"
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
          />
          <button type="submit" className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">
            <Check className="h-3.5 w-3.5" /> Criar
          </button>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const columnRows = column.itemIds.map((id) => rowById.get(id)).filter((row): row is CalculatedItemRow => Boolean(row));
          const isDropTarget = dragOverColumn === column.id;
          return (
            <div
              key={column.id}
              onDragOver={(event) => { event.preventDefault(); setDragOverColumn(column.id); }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedItemId) onMoveItem(draggedItemId, column.id);
                setDraggedItemId(null);
                setDragOverColumn(null);
              }}
              className={`min-h-32 rounded-lg border bg-white p-2 transition ${isDropTarget ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200'}`}
            >
              <div className="mb-2 flex items-center justify-between border-b border-slate-100 px-1 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{column.title}</h3>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{columnRows.length}</span>
                </div>
                {!column.locked && (
                  <button type="button" title="Excluir coluna" onClick={() => onDeleteColumn(column.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {columnRows.map((row) => (
                  <div
                    key={row.item.id}
                    draggable
                    onDragStart={() => setDraggedItemId(row.item.id)}
                    onDragEnd={() => { setDraggedItemId(null); setDragOverColumn(null); }}
                    className="group flex cursor-grab items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1.5 active:cursor-grabbing"
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      {editingItemId === row.item.id ? (
                        <form onSubmit={(event) => { event.preventDefault(); saveItemName(); }} className="flex gap-1">
                          <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="min-w-0 w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-[11px] outline-none" />
                          <button type="submit" title="Salvar nome" className="text-emerald-600"><Check className="h-3 w-3" /></button>
                        </form>
                      ) : (
                        <span className="block truncate text-[11px] font-semibold text-slate-800">{row.item.name}</span>
                      )}
                      <span className="block text-[10px] text-slate-500">Saldo: {row.saldoReal} · Físico: {row.fisico}</span>
                    </div>
                    {editingItemId !== row.item.id && (
                      <button
                        type="button"
                        title="Editar nome"
                        onClick={() => { setEditingItemId(row.item.id); setEditingName(row.item.name); }}
                        className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-blue-700"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {columnRows.length === 0 && <div className="rounded border border-dashed border-slate-300 px-2 py-4 text-center text-[10px] text-slate-400">Solte um item aqui</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
