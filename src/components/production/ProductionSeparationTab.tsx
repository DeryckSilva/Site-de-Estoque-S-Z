import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Archive, ClipboardList, LoaderCircle, Search, Save } from 'lucide-react';
import { sharedWmsClient } from '../../services/sharedWmsStore';
import {
  createProductionSeparation,
  finalizeProductionSeparation,
  listProductionSeparations,
  parseRealtimeProductionSeparation,
  saveProductionSeparation,
} from '../../services/productionSeparationService';
import type {
  ProductionSeparationRecord,
  SeparatedEquipment,
  SharedProductionSeparation,
} from '../../types/productionSeparation';
import { loadOrderLedgerRows } from '../../services/googleSheetOrders';
import {
  generateProductionSeparationSequence,
  type ProductionSeparationRow,
  type ProductionSeparationSequence,
} from '../../utils/productionSeparationGenerator';
import { ProductionSeparationHistoryPanel } from './ProductionSeparationHistoryPanel';
import { ProductionEquipmentSwapPanel } from './ProductionEquipmentSwapPanel';
import { ProductionEquipmentSwapHistoryPanel } from './ProductionEquipmentSwapHistoryPanel';

const CURRENT_SEQUENCE_ID = '00000000-0000-4000-8000-000000000001';
type SeparationSection = 'current' | 'history' | 'swap' | 'swapHistory';

const SECTIONS: Array<{ id: SeparationSection; label: string }> = [
  { id: 'current', label: 'Separação atual' },
  { id: 'history', label: 'Histórico' },
  { id: 'swap', label: 'Troca manual' },
  { id: 'swapHistory', label: 'Histórico de trocas' },
];

const COLUMNS: Array<{ key: keyof Omit<ProductionSeparationRow, 'id'>; label: string }> = [
  { key: 'orderNumber', label: 'Nº do pedido' },
  { key: 'equipmentType', label: 'Tipo de equipamento' },
  { key: 'serialNumber', label: 'Serial' },
  { key: 'ccid', label: 'CCID / chip' },
  { key: 'terminalColor', label: 'Cor termo' },
  { key: 'terminalSize', label: 'Tam. termo' },
  { key: 'terminalDiameter', label: 'Diâmetro' },
  { key: 'terminalQuantity', label: 'Qtd. termo' },
  { key: 'battery', label: 'Bateria' },
  { key: 'kraftBoxType', label: 'Tipo cx. Kraft' },
  { key: 'kraftQuantity', label: 'Qtd. Kraft' },
  { key: 'box3dType', label: 'Tipo cx. 3D' },
  { key: 'box3dQuantity', label: 'Qtd. 3D' },
  { key: 'magnetType', label: 'Tipo ímã' },
  { key: 'magnetQuantity', label: 'Qtd. ímã' },
  { key: 'deliveryDate', label: 'Data' },
  { key: 'responsible', label: 'Responsável' },
];

const REPEATED_COLUMNS = COLUMNS.filter(({ key }) => key !== 'serialNumber' && key !== 'ccid');

type DistinctFieldKey = 'serialNumber' | 'ccid';

function isDistinctFieldKey(key: keyof Omit<ProductionSeparationRow, 'id'>): key is DistinctFieldKey {
  return key === 'serialNumber' || key === 'ccid';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function parseBatchLines(value: string): string[] {
  const lines = value.replace(/\r/g, '').split('\n').map((line) => line.trim());
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function parseTabSeparatedBatch(value: string): Array<{ serial: string; ccid: string }> {
  const lines = value.replace(/\r/g, '').split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.map((line) => {
    const columns = line.split('\t');
    return {
      serial: (columns[0] ?? '').trim(),
      ccid: (columns[1] ?? '').trim(),
    };
  });
}

function toRecord(sequence: ProductionSeparationSequence): ProductionSeparationRecord {
  const equipment: SeparatedEquipment[] = sequence.rows.map((row) => ({
    id: row.id,
    equipmentType: row.equipmentType,
    serialNumber: row.serialNumber,
    ccid: row.ccid,
    terminalColor: row.terminalColor,
    terminalSize: row.terminalSize,
    terminalDiameter: row.terminalDiameter,
    terminalQuantity: row.terminalQuantity,
    batteryType: row.battery,
    kraftBoxType: row.kraftBoxType,
    kraftQuantity: row.kraftQuantity,
    box3dType: row.box3dType,
    box3dQuantity: row.box3dQuantity,
    magnetType: row.magnetType,
    magnetQuantity: row.magnetQuantity,
    productionDeliveryDate: row.deliveryDate,
    productionResponsible: row.responsible,
  }));

  return {
    id: CURRENT_SEQUENCE_ID,
    orderNumber: sequence.orderNumber,
    clientName: sequence.clientName,
    orderDetails: {
      requestedQuantity: sequence.rows.length,
      productType: '',
      operator: '',
      equipmentModel: '',
      modelVariation: '',
      colorVariation: '',
      businessType: '',
      deliveryType: '',
      requestDate: '',
      expectedDeliveryDate: '',
    },
    separatedBy: '',
    deliveryResponsible: '',
    separationDate: localDate(),
    equipment,
  };
}

function fromRecord(record: ProductionSeparationRecord): ProductionSeparationSequence {
  return {
    orderNumber: record.orderNumber,
    clientName: record.clientName,
    rows: record.equipment.map((item) => ({
      id: item.id,
      orderNumber: record.orderNumber,
      equipmentType: item.equipmentType,
      serialNumber: item.serialNumber,
      ccid: item.ccid,
      terminalColor: item.terminalColor,
      terminalSize: item.terminalSize,
      terminalDiameter: item.terminalDiameter,
      terminalQuantity: String(item.terminalQuantity),
      battery: item.batteryType,
      kraftBoxType: item.kraftBoxType,
      kraftQuantity: String(item.kraftQuantity),
      box3dType: item.box3dType,
      box3dQuantity: String(item.box3dQuantity),
      magnetType: item.magnetType,
      magnetQuantity: String(item.magnetQuantity),
      deliveryDate: item.productionDeliveryDate,
      responsible: item.productionResponsible,
    })),
  };
}

export function ProductionSeparationTab() {
  const [orderNumber, setOrderNumber] = useState('');
  const [sequence, setSequence] = useState<ProductionSeparationSequence | null>(null);
  const [sharedRecord, setSharedRecord] = useState<SharedProductionSeparation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCurrentSequence, setLoadingCurrentSequence] = useState(Boolean(sharedWmsClient));
  const [isDirty, setIsDirty] = useState(false);
  const [serialBatch, setSerialBatch] = useState('');
  const [ccidBatch, setCcidBatch] = useState('');
  const [activeSection, setActiveSection] = useState<SeparationSection>('current');
  const [finalizing, setFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);

  function markDirty(value: boolean) {
    isDirtyRef.current = value;
    setIsDirty(value);
  }

  useEffect(() => {
    const client = sharedWmsClient;
    if (!client) {
      setNotice('A sequência pode ser gerada e editada, mas o compartilhamento não está configurado neste site.');
      return;
    }

    let active = true;
    const channel = client
      .channel('production-separation-current')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_separations' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { id?: unknown }).id;
          if (deletedId === CURRENT_SEQUENCE_ID && active) {
            setSharedRecord(null);
            if (!isDirtyRef.current) setSequence(null);
          }
          return;
        }

        try {
          const incoming = parseRealtimeProductionSeparation(payload.new);
          if (incoming.id !== CURRENT_SEQUENCE_ID || !active) return;
          if (isDirtyRef.current && !isSavingRef.current) {
            setErrorMessage('A sequência foi alterada por outro usuário. Atualize antes de salvar suas alterações.');
            return;
          }
          if (isSavingRef.current) return;
          setSharedRecord(incoming);
          setSequence(fromRecord(incoming));
          setNotice('Sequência atualizada por outro usuário.');
        } catch (error) {
          console.error('O Supabase enviou uma sequência de separação inválida:', error);
          if (active) setErrorMessage('O Supabase enviou uma sequência inválida. Atualize a página.');
        }
      })
      .subscribe();

    listProductionSeparations()
      .then((records) => {
        if (!active) return;
        const current = records.find((record) => record.id === CURRENT_SEQUENCE_ID) || null;
        setSharedRecord(current);
        if (current) {
          setSequence(fromRecord(current));
          setOrderNumber(current.orderNumber);
        }
      })
      .catch((error) => {
        console.error('Falha ao carregar a sequência compartilhada:', error);
        if (active) setErrorMessage(`Não foi possível carregar a sequência compartilhada. ${getErrorMessage(error)}`);
      })
      .finally(() => {
        if (active) setLoadingCurrentSequence(false);
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);

  async function persistSequence(candidate: ProductionSeparationSequence): Promise<SharedProductionSeparation | null> {
    if (!sharedWmsClient) {
      setNotice('Alterações disponíveis apenas nesta tela: o compartilhamento não está configurado.');
      markDirty(true);
      return null;
    }

    setSaving(true);
    isSavingRef.current = true;
    setErrorMessage('');
    try {
      const record = toRecord(candidate);
      const saved = sharedRecord?.id === CURRENT_SEQUENCE_ID
        ? await saveProductionSeparation({
            ...record,
            revision: sharedRecord.revision,
            updatedAt: sharedRecord.updatedAt,
          })
        : await createProductionSeparation(record);
      setSharedRecord(saved);
      setSequence(fromRecord(saved));
      markDirty(false);
      setNotice('Sequência salva e compartilhada com a equipe.');
      return saved;
    } catch (error) {
      console.error('Falha ao salvar a sequência compartilhada:', error);
      setErrorMessage(`A sequência está visível nesta tela, mas não foi salva no compartilhamento. ${getErrorMessage(error)}`);
      return null;
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (!sequence) return;
    if (!sharedWmsClient) {
      setErrorMessage('Configure o Supabase e execute separation-control.sql antes de arquivar separações.');
      return;
    }

    setFinalizing(true);
    setErrorMessage('');
    try {
      const current = isDirty || !sharedRecord
        ? await persistSequence(sequence)
        : sharedRecord;
      if (!current) return;
      await finalizeProductionSeparation(current);
      setSequence(null);
      setSharedRecord(null);
      setOrderNumber('');
      setSerialBatch('');
      setCcidBatch('');
      markDirty(false);
      setActiveSection('history');
    } catch (error) {
      console.error('Falha ao finalizar e arquivar a separação:', error);
      setErrorMessage(`Não foi possível arquivar a separação. ${getErrorMessage(error)}`);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    setErrorMessage('');
    setNotice('');

    try {
      const ledgerRows = await loadOrderLedgerRows();
      const generated = generateProductionSeparationSequence(ledgerRows, orderNumber);
      setSequence(generated);
      markDirty(true);
      if (sharedWmsClient) await persistSequence(generated);
      else setNotice('Sequência gerada nesta tela. Configure o compartilhamento para que a equipe também possa acessá-la.');
    } catch (error) {
      console.error('Falha ao gerar a sequência de separação:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  function updateRepeatedField(key: (typeof REPEATED_COLUMNS)[number]['key'], value: string) {
    if (key === 'orderNumber') setOrderNumber(value);
    setSequence((current) => {
      if (!current) return current;
      if (key === 'orderNumber') {
        return {
          ...current,
          orderNumber: value,
          rows: current.rows.map((row) => ({ ...row, orderNumber: value })),
        };
      }
      return {
        ...current,
        rows: current.rows.map((row) => ({ ...row, [key]: value })),
      };
    });
    markDirty(true);
  }

  function updateDistinctValue(rowId: string, key: DistinctFieldKey, value: string) {
    setSequence((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)),
      };
    });
    markDirty(true);
  }

  function updateClientName(value: string) {
    setSequence((current) => current ? { ...current, clientName: value } : current);
    markDirty(true);
  }

  function applyBatchValues() {
    if (!sequence) return;
    setErrorMessage('');
    setNotice('');

    const tabSeparatedRows = !ccidBatch.trim() && serialBatch.includes('\t')
      ? parseTabSeparatedBatch(serialBatch)
      : null;
    const serials = tabSeparatedRows
      ? tabSeparatedRows.map((row) => row.serial)
      : parseBatchLines(serialBatch);
    const ccids = tabSeparatedRows
      ? tabSeparatedRows.map((row) => row.ccid)
      : parseBatchLines(ccidBatch);
    if (!serials.length && !ccids.length) {
      setErrorMessage('Cole pelo menos uma lista de seriais ou chips.');
      return;
    }
    if (serials.length > sequence.rows.length || ccids.length > sequence.rows.length) {
      setErrorMessage(`A sequência tem ${sequence.rows.length} unidades. Reduza a lista para não ultrapassar essa quantidade.`);
      return;
    }

    setSequence((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row, index) => ({
          ...row,
          ...(index < serials.length ? { serialNumber: serials[index] } : {}),
          ...(index < ccids.length ? { ccid: ccids[index] } : {}),
        })),
      };
    });
    markDirty(true);
    const saveHint = sharedWmsClient
      ? 'Salve as alterações para compartilhar.'
      : 'O compartilhamento não está configurado neste site.';
    setNotice(`Lote aplicado: ${serials.length} seriais e ${ccids.length} chips/CCIDs. ${saveHint}`);
    setSerialBatch('');
    setCcidBatch('');
  }

  return (
    <div className="space-y-5">
      <nav role="tablist" aria-label="Abas de separação" className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={activeSection === section.id}
            onClick={() => setActiveSection(section.id)}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activeSection === section.id
                ? 'bg-blue-700 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className={activeSection === 'current' ? 'space-y-5' : 'hidden'}>
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Separação de pedidos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Informe o número do pedido para gerar a sequência a partir de Lançamentos.
          </p>
        </div>
      </header>

      <form onSubmit={handleGenerate} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm font-medium text-slate-700">
          Nº do pedido
          <input
            type="text"
            required
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder="Digite o número do pedido"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <button
          type="submit"
          disabled={generating || loadingCurrentSequence}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating || loadingCurrentSequence ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loadingCurrentSequence ? 'Carregando...' : generating ? 'Gerando...' : 'Gerar sequência'}
        </button>
      </form>

      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {notice && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{notice}</p>}

      {sequence ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="font-semibold text-slate-900">Pedido {sequence.orderNumber}</h2>
              <label className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                Cliente:
                <input
                  type="text"
                  value={sequence.clientName}
                  onChange={(event) => updateClientName(event.target.value)}
                  className="min-w-40 rounded border border-transparent bg-transparent px-1 py-0.5 outline-none focus:border-blue-400 focus:bg-white"
                />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
                {sequence.rows.length} {sequence.rows.length === 1 ? 'unidade' : 'unidades'}
              </span>
              {isDirty && sharedWmsClient && (
                <button
                  type="button"
                  disabled={saving || finalizing}
                  onClick={() => void persistSequence(sequence)}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              )}
              {sequence && (
                <button
                  type="button"
                  disabled={saving || finalizing}
                  onClick={() => void handleFinalize()}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {finalizing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  {finalizing ? 'Arquivando...' : 'Finalizar e arquivar'}
                </button>
              )}
            </div>
          </div>

          <div className="border-b border-slate-200 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Campos repetidos em todas as unidades</h3>
              <p className="mt-1 text-xs text-slate-500">
                Edite cada valor uma vez aqui; a alteração é aplicada a todas as linhas. Serial e CCID são preenchidos por unidade.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {REPEATED_COLUMNS.map((column) => (
                <label key={column.key} className="block text-xs font-medium text-slate-600">
                  {column.label}
                  <input
                    type="text"
                    value={sequence.rows[0]?.[column.key] ?? ''}
                    onChange={(event) => updateRepeatedField(column.key, event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="block text-xs font-medium text-slate-700">
              Seriais — um por linha
              <textarea
                rows={4}
                value={serialBatch}
                onChange={(event) => setSerialBatch(event.target.value)}
                placeholder={'SERIAL001\nSERIAL002\nSERIAL003'}
                className="mt-1 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Chips / CCID — um por linha
              <textarea
                rows={4}
                value={ccidBatch}
                onChange={(event) => setCcidBatch(event.target.value)}
                placeholder={'CCID001\nCCID002\nCCID003'}
                className="mt-1 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <button
              type="button"
              onClick={applyBatchValues}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
            >
              <ClipboardList className="h-4 w-4" />
              Aplicar em lote
            </button>
            <p className="text-xs text-slate-500 lg:col-span-3">
              Cole uma lista por área ou duas colunas tabuladas em Seriais. A linha 1 corresponde à unidade 1; linhas vazias limpam essa posição, linhas ausentes preservam os valores restantes e excedentes são recusadas.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[2200px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key} className="border-b border-slate-200 px-2 py-2 font-semibold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sequence.rows.map((row, rowIndex) => (
                  <tr key={row.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {COLUMNS.map((column) => {
                      const key = column.key;
                      return (
                        <td key={key} className="border-b border-slate-100 px-1.5 py-1">
                          {isDistinctFieldKey(key) ? (
                          <input
                            type="text"
                            aria-label={`${column.label}, linha ${rowIndex + 1}`}
                            value={row[key]}
                            onChange={(event) => updateDistinctValue(row.id, key, event.target.value)}
                            className="w-full min-w-24 rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-100"
                          />
                        ) : (
                          <span className="block min-w-24 px-1.5 py-1 text-xs text-slate-800">
                            {row[key]}
                          </span>
                        )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
            Os valores repetidos são editados no painel acima. Serial e CCID podem ser ajustados por linha. Gerar outro pedido substitui a sequência atual.
          </p>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {loadingCurrentSequence ? 'Carregando a sequência compartilhada...' : 'A sequência do pedido aparecerá aqui após a geração.'}
        </div>
      )}
      </div>

      {activeSection === 'history' && <ProductionSeparationHistoryPanel />}
      {activeSection === 'swap' && <ProductionEquipmentSwapPanel />}
      {activeSection === 'swapHistory' && <ProductionEquipmentSwapHistoryPanel />}
    </div>
  );
}
