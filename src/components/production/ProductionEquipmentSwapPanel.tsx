import { useState, type FormEvent } from 'react';
import { AlertCircle, LoaderCircle, Repeat2 } from 'lucide-react';
import { createProductionEquipmentSwap } from '../../services/productionSeparationService';
import type { EquipmentSwapComponent } from '../../types/productionSeparation';

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível registrar a troca.';
}

function isSwapComponent(value: string): value is EquipmentSwapComponent {
  return value === 'serial' || value === 'ccid';
}

export function ProductionEquipmentSwapPanel() {
  const [orderNumber, setOrderNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [component, setComponent] = useState<EquipmentSwapComponent>('serial');
  const [previousValue, setPreviousValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [responsible, setResponsible] = useState('');
  const [swappedOn, setSwappedOn] = useState(localDate);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setNotice('');
    try {
      await createProductionEquipmentSwap({
        orderNumber,
        clientName,
        equipmentType,
        component,
        previousValue,
        newValue,
        responsible,
        swappedOn,
      });
      setNotice(`Troca de ${component === 'serial' ? 'serial' : 'chip/CCID'} registrada. O valor antigo foi mantido no histórico.`);
      setPreviousValue('');
      setNewValue('');
    } catch (error) {
      console.error('Falha ao registrar troca de equipamento:', error);
      setErrorMessage(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><Repeat2 className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Registrar troca manual</h2>
          <p className="text-sm text-slate-600">Registre somente a troca de Serial ou Chip/CCID. O valor antigo não é apagado.</p>
        </div>
      </header>

      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Nº do pedido
          <input required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Cliente
          <input value={clientName} onChange={(event) => setClientName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Equipamento
          <input value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Item da troca
          <select value={component} onChange={(event) => { if (isSwapComponent(event.target.value)) setComponent(event.target.value); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
            <option value="serial">Serial</option>
            <option value="ccid">Chip / CCID</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Valor antigo
          <input required value={previousValue} onChange={(event) => setPreviousValue(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Valor novo
          <input required value={newValue} onChange={(event) => setNewValue(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Responsável
          <input value={responsible} onChange={(event) => setResponsible(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Data da troca
          <input required type="date" value={swappedOn} onChange={(event) => setSwappedOn(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
            {saving ? 'Registrando...' : 'Registrar troca'}
          </button>
        </div>
      </form>

      <p className="text-xs text-slate-500">
        A troca é registrada como um novo evento e não altera as separações concluídas; assim, os valores anteriores continuam preservados.
      </p>
    </section>
  );
}
