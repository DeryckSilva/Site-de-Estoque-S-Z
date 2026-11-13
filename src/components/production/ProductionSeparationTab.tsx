import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { ORDERS_DATABASE } from '../../data/ordersDatabase';
import { loadOrdersFromGoogleSheet } from '../../services/googleSheetOrders';
import { sharedWmsClient } from '../../services/sharedWmsStore';
import {
  createProductionSeparation,
  deleteProductionSeparation,
  listProductionSeparations,
  parseRealtimeProductionSeparation,
  saveProductionSeparation,
} from '../../services/productionSeparationService';
import type {
  ProductionSeparationRecord,
  SeparationOrderDetails,
  SeparatedEquipment,
  SharedProductionSeparation,
} from '../../types/productionSeparation';
import type { BaseOrder } from '../../types/orders';

type TextEquipmentField = keyof Pick<
  SeparatedEquipment,
  | 'equipmentType'
  | 'serialNumber'
  | 'ccid'
  | 'terminalColor'
  | 'terminalSize'
  | 'terminalDiameter'
  | 'batteryType'
  | 'kraftBoxType'
  | 'box3dType'
  | 'magnetType'
  | 'productionDeliveryDate'
  | 'productionResponsible'
>;

type NumberEquipmentField = keyof Pick<
  SeparatedEquipment,
  'terminalQuantity' | 'kraftQuantity' | 'box3dQuantity' | 'magnetQuantity'
>;

const TEXT_EQUIPMENT_FIELDS: Array<{ key: TextEquipmentField; label: string; type?: 'text' | 'date' }> = [
  { key: 'equipmentType', label: 'Tipo de equipamento' },
  { key: 'serialNumber', label: 'Serial' },
  { key: 'ccid', label: 'CCID / chip' },
  { key: 'terminalColor', label: 'Cor do termo' },
  { key: 'terminalSize', label: 'Tamanho do termo' },
  { key: 'terminalDiameter', label: 'Diâmetro' },
  { key: 'batteryType', label: 'Bateria' },
  { key: 'kraftBoxType', label: 'Tipo de caixa Kraft' },
  { key: 'box3dType', label: 'Tipo de caixa 3D' },
  { key: 'magnetType', label: 'Tipo de ímã' },
  { key: 'productionDeliveryDate', label: 'Data de entrega à Produção', type: 'date' },
  { key: 'productionResponsible', label: 'Responsável pelo recebimento' },
];

const NUMBER_EQUIPMENT_FIELDS: Array<{ key: NumberEquipmentField; label: string }> = [
  { key: 'terminalQuantity', label: 'Qtd. de termos' },
  { key: 'kraftQuantity', label: 'Qtd. caixas Kraft' },
  { key: 'box3dQuantity', label: 'Qtd. caixas 3D' },
  { key: 'magnetQuantity', label: 'Qtd. ímãs' },
];

const EMPTY_ORDER_DETAILS: SeparationOrderDetails = {
  requestedQuantity: 0,
  productType: '',
  operator: '',
  equipmentModel: '',
  modelVariation: '',
  colorVariation: '',
  businessType: '',
  deliveryType: '',
  requestDate: '',
  expectedDeliveryDate: '',
};

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function createEmptyEquipment(details: SeparationOrderDetails = EMPTY_ORDER_DETAILS): SeparatedEquipment {
  return {
    id: crypto.randomUUID(),
    equipmentType: details.equipmentModel || '',
    serialNumber: '',
    ccid: '',
    terminalColor: details.colorVariation || '',
    terminalSize: '',
    terminalDiameter: '',
    terminalQuantity: 0,
    batteryType: '',
    kraftBoxType: '',
    kraftQuantity: 0,
    box3dType: '',
    box3dQuantity: 0,
    magnetType: '',
    magnetQuantity: 0,
    productionDeliveryDate: '',
    productionResponsible: '',
  };
}

function createId(): string {
  return crypto.randomUUID();
}

function normalizeOrderNumber(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function getOrderDetails(order: BaseOrder): SeparationOrderDetails {
  return {
    requestedQuantity: order.quantidade || 0,
    productType: order.tipoItem || '',
    operator: order.operadora || '',
    equipmentModel: order.geracao || order.mappedItemName || '',
    modelVariation: order.modeloVariacao || '',
    colorVariation: order.corVariacao || '',
    businessType: order.tipoNegocio || '',
    deliveryType: order.tipoEntrega || '',
    requestDate: order.dataSolicitacao || '',
    expectedDeliveryDate: order.dataEnvio || '',
  };
}

function inputClass(): string {
  return 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
}

function HeaderField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date';
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass()}
      />
    </label>
  );
}

function OrderDetailsFields({
  details,
  onChange,
}: {
  details: SeparationOrderDetails;
  onChange: (details: SeparationOrderDetails) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-xs font-medium text-slate-600">
        Quantidade solicitada
        <input
          type="number"
          min="0"
          value={details.requestedQuantity}
          onChange={(event) => onChange({ ...details, requestedQuantity: Math.max(0, Number(event.target.value) || 0) })}
          className={inputClass()}
        />
      </label>
      <HeaderField label="Tipo de item" value={details.productType} onChange={(value) => onChange({ ...details, productType: value })} />
      <HeaderField label="Operadora" value={details.operator} onChange={(value) => onChange({ ...details, operator: value })} />
      <HeaderField label="Equipamento / geração" value={details.equipmentModel} onChange={(value) => onChange({ ...details, equipmentModel: value })} />
      <HeaderField label="Modelo / variação" value={details.modelVariation} onChange={(value) => onChange({ ...details, modelVariation: value })} />
      <HeaderField label="Cor / acabamento" value={details.colorVariation} onChange={(value) => onChange({ ...details, colorVariation: value })} />
      <HeaderField label="Tipo de negócio" value={details.businessType} onChange={(value) => onChange({ ...details, businessType: value })} />
      <HeaderField label="Tipo de entrega" value={details.deliveryType} onChange={(value) => onChange({ ...details, deliveryType: value })} />
      <HeaderField label="Data da solicitação" value={details.requestDate} onChange={(value) => onChange({ ...details, requestDate: value })} />
      <HeaderField label="Previsão de entrega" value={details.expectedDeliveryDate} onChange={(value) => onChange({ ...details, expectedDeliveryDate: value })} />
    </div>
  );
}

function SeparationCard({
  record,
  onSave,
  onDelete,
}: {
  record: SharedProductionSeparation;
  onSave: (record: SharedProductionSeparation) => Promise<void>;
  onDelete: (record: SharedProductionSeparation) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SharedProductionSeparation>(record);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(record);
  }, [record]);

  const updateTextField = (key: TextEquipmentField, lineId: string, value: string) => {
    setDraft((current) => ({
      ...current,
      equipment: current.equipment.map((line) => line.id === lineId ? { ...line, [key]: value } : line),
    }));
  };

  const updateNumberField = (key: NumberEquipmentField, lineId: string, value: number) => {
    setDraft((current) => ({
      ...current,
      equipment: current.equipment.map((line) => line.id === lineId ? { ...line, [key]: value } : line),
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
    } catch (saveError) {
      console.error('Falha ao salvar a separação:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Excluir o controle de separação do pedido ${record.orderNumber}?`)) return;
    setError('');
    try {
      await onDelete(record);
    } catch (deleteError) {
      console.error('Falha ao excluir a separação:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir este controle.');
    }
  };

  const serialCount = draft.equipment.filter((line) => line.serialNumber.trim()).length;
  const chipCount = draft.equipment.filter((line) => line.ccid.trim()).length;
  const orderDetails = draft.orderDetails || EMPTY_ORDER_DETAILS;

  return (
    <details className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
        <div>
          <strong className="text-sm text-slate-900">{record.orderNumber}</strong>
          <span className="ml-2 text-xs text-slate-500">{record.clientName || 'Cliente não informado'}</span>
          <p className="mt-1 text-[11px] text-slate-500">
            {orderDetails.equipmentModel || 'Equipamento não informado'} · {record.separationDate || 'Sem data'} · Separado por {record.separatedBy || 'não informado'}
          </p>
        </div>
        <div className="flex gap-2 text-[11px] font-semibold">
          {orderDetails.requestedQuantity > 0 && (
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">
              {serialCount}/{orderDetails.requestedQuantity} unidades
            </span>
          )}
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">{serialCount} serial(is)</span>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-800">{chipCount} chip(s)</span>
        </div>
      </summary>
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HeaderField label="Nº do pedido" value={draft.orderNumber} required onChange={(value) => setDraft((current) => ({ ...current, orderNumber: value }))} />
          <HeaderField label="Nome do cliente" value={draft.clientName} onChange={(value) => setDraft((current) => ({ ...current, clientName: value }))} />
          <HeaderField label="Quem separou" value={draft.separatedBy} onChange={(value) => setDraft((current) => ({ ...current, separatedBy: value }))} />
          <HeaderField label="Responsável pela entrega" value={draft.deliveryResponsible} onChange={(value) => setDraft((current) => ({ ...current, deliveryResponsible: value }))} />
          <HeaderField label="Data de separação" type="date" value={draft.separationDate} onChange={(value) => setDraft((current) => ({ ...current, separationDate: value }))} />
        </div>

        <section className="space-y-2 rounded-lg bg-slate-50 p-3">
          <h3 className="text-xs font-bold text-slate-700">Informações do pedido · editáveis</h3>
          <OrderDetailsFields
            details={orderDetails}
            onChange={(details) => setDraft((current) => ({ ...current, orderDetails: details }))}
          />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Equipamentos separados</h3>
            <p className="text-[11px] text-slate-500">Registre serial, CCID/chip e os acessórios de cada unidade.</p>
          </div>
          <button
            type="button"
            onClick={() => setDraft((current) => ({
              ...current,
              equipment: [...current.equipment, createEmptyEquipment(current.orderDetails || EMPTY_ORDER_DETAILS)],
            }))}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar equipamento
          </button>
        </div>

        {draft.equipment.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
            Ainda não há equipamentos neste pedido.
          </p>
        )}

        {draft.equipment.map((line, index) => (
          <fieldset key={line.id} className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-bold text-slate-700">Equipamento {index + 1}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {TEXT_EQUIPMENT_FIELDS.map((field) => (
                <label key={field.key} className="block text-[11px] font-medium text-slate-600">
                  {field.label}
                  <input
                    type={field.type || 'text'}
                    value={line[field.key]}
                    onChange={(event) => updateTextField(field.key, line.id, event.target.value)}
                    className={inputClass()}
                  />
                </label>
              ))}
              {NUMBER_EQUIPMENT_FIELDS.map((field) => (
                <label key={field.key} className="block text-[11px] font-medium text-slate-600">
                  {field.label}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line[field.key]}
                    onChange={(event) => updateNumberField(field.key, line.id, Math.max(0, Number(event.target.value) || 0))}
                    className={inputClass()}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() => setDraft((current) => ({ ...current, equipment: current.equipment.filter((item) => item.id !== line.id) }))}
                className="mt-auto inline-flex items-center justify-center gap-1 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover equipamento
              </button>
            </div>
          </fieldset>
        ))}

        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void remove()} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Excluir pedido
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || !draft.orderNumber.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar separação'}
          </button>
        </div>
      </div>
    </details>
  );
}

export function ProductionSeparationTab() {
  const [records, setRecords] = useState<SharedProductionSeparation[]>([]);
  const [knownOrders, setKnownOrders] = useState<BaseOrder[]>(ORDERS_DATABASE);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderLoadError, setOrderLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [prefilledOrderNumber, setPrefilledOrderNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [orderDetails, setOrderDetails] = useState<SeparationOrderDetails>(EMPTY_ORDER_DETAILS);
  const [separatedBy, setSeparatedBy] = useState('');
  const [deliveryResponsible, setDeliveryResponsible] = useState('');
  const [separationDate, setSeparationDate] = useState(localDate);

  useEffect(() => {
    let active = true;
    void loadOrdersFromGoogleSheet()
      .then((sheetOrders) => {
        if (!active) return;
        const merged = new Map(
          ORDERS_DATABASE.map((order) => [normalizeOrderNumber(order.numPedido), order])
        );
        sheetOrders.forEach((order) => merged.set(normalizeOrderNumber(order.numPedido), order));
        setKnownOrders([...merged.values()]);
      })
      .catch((loadError) => {
        console.error('Falha ao carregar pedidos para preenchimento da separação:', loadError);
        if (active) setOrderLoadError('A lista online de pedidos não carregou. Pedidos locais continuam disponíveis.');
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const matchedOrder = useMemo(
    () => knownOrders.find((order) => normalizeOrderNumber(order.numPedido) === normalizeOrderNumber(orderNumber)),
    [knownOrders, orderNumber]
  );
  const isOrderPrefilled = Boolean(
    matchedOrder && prefilledOrderNumber === normalizeOrderNumber(orderNumber)
  );

  useEffect(() => {
    if (ordersLoading) return;
    const normalized = normalizeOrderNumber(orderNumber);
    if (!normalized) {
      setPrefilledOrderNumber('');
      setClientName('');
      setOrderDetails(EMPTY_ORDER_DETAILS);
      return;
    }
    if (matchedOrder) {
      if (prefilledOrderNumber !== normalized) {
        setPrefilledOrderNumber(normalized);
        setClientName(matchedOrder.cliente);
        setOrderDetails(getOrderDetails(matchedOrder));
      }
      return;
    }
    if (prefilledOrderNumber !== normalized) {
      setPrefilledOrderNumber('');
      setClientName('');
      setOrderDetails(EMPTY_ORDER_DETAILS);
    }
  }, [matchedOrder, orderNumber, ordersLoading, prefilledOrderNumber]);

  const loadRecords = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setPageError('');
    try {
      const loaded = await listProductionSeparations();
      setRecords(loaded);
    } catch (loadError) {
      console.error('Falha ao carregar o controle de separação:', loadError);
      setPageError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as separações.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const client = sharedWmsClient;
    if (!client) {
      setPageError('O Supabase compartilhado não está configurado neste site.');
      setLoading(false);
      return;
    }
    let active = true;
    void loadRecords();
    const channel = client
      .channel('production-separations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_separations' }, (payload) => {
        if (!active) return;
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: unknown }).id;
          if (typeof id === 'string') setRecords((current) => current.filter((record) => record.id !== id));
          return;
        }
        try {
          const record = parseRealtimeProductionSeparation(payload.new);
          setRecords((current) => [
            record,
            ...current.filter((existing) => existing.id !== record.id),
          ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        } catch (parseError) {
          console.error('O Supabase enviou um registro de separação inválido:', parseError);
          setPageError('O Supabase enviou um registro de separação inválido. Atualize a tela.');
        }
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setPageError('A sincronização em tempo real falhou. Atualize a tela para conferir os dados mais recentes.');
        }
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    if (!query) return records;
    return records.filter((record) =>
      [
        record.orderNumber,
        record.clientName,
        record.separatedBy,
        record.orderDetails?.equipmentModel || '',
        record.orderDetails?.modelVariation || '',
        ...record.equipment.map((line) => line.serialNumber),
        ...record.equipment.map((line) => line.ccid),
      ]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(query))
    );
  }, [records, search]);

  const addRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orderNumber.trim()) return;
    setSavingNew(true);
    setPageError('');
    const record: ProductionSeparationRecord = {
      id: createId(),
      orderNumber: orderNumber.trim(),
      clientName: clientName.trim(),
      orderDetails,
      separatedBy: separatedBy.trim(),
      deliveryResponsible: deliveryResponsible.trim(),
      separationDate,
      equipment: [],
    };
    try {
      const created = await createProductionSeparation(record);
      setRecords((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setOrderNumber('');
      setPrefilledOrderNumber('');
      setClientName('');
      setOrderDetails(EMPTY_ORDER_DETAILS);
      setSeparatedBy('');
      setDeliveryResponsible('');
      setSeparationDate(localDate());
    } catch (createError) {
      console.error('Falha ao criar o controle de separação:', createError);
      setPageError(createError instanceof Error ? createError.message : 'Não foi possível criar o controle.');
    } finally {
      setSavingNew(false);
    }
  };

  const saveRecord = async (record: SharedProductionSeparation) => {
    const saved = await saveProductionSeparation(record);
    setRecords((current) => current.map((item) => item.id === saved.id ? saved : item));
  };

  const removeRecord = async (record: SharedProductionSeparation) => {
    await deleteProductionSeparation(record);
    setRecords((current) => current.filter((item) => item.id !== record.id));
  };

  const totalEquipment = records.reduce((sum, record) => sum + record.equipment.length, 0);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Separação de pedidos</h1>
          <p className="text-xs text-slate-500">Controle por pedido, equipamento, serial, chip e acessórios.</p>
        </div>
        <button type="button" onClick={() => void loadRecords(true)} disabled={refreshing} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </header>

      <div role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p><strong>Acesso público:</strong> este controle é compartilhado sem login. Qualquer pessoa com acesso ao site poderá consultar, criar, alterar e excluir os registros. Não informe dados que não possam ser públicos.</p>
      </div>

      {pageError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {pageError}
          {!sharedWmsClient && <span> Configure as variáveis Supabase conforme o README e execute o script SQL de separação.</span>}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-blue-700" />
          <h2 className="text-sm font-bold text-slate-900">Iniciar nova separação</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Informe apenas o número do pedido. Cliente, quantidade e especificações são buscados automaticamente; você pode revisá-los e editá-los.
        </p>
        <form onSubmit={(event) => void addRecord(event)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block text-xs font-medium text-slate-600">
              Nº do pedido
              <input
                type="text"
                list="production-order-options"
                required
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value)}
                placeholder="Digite ou selecione o número do pedido"
                className={inputClass()}
              />
              <datalist id="production-order-options">
                {knownOrders.map((order) => (
                  <option key={`${order.id}-${order.numPedido}`} value={order.numPedido}>
                    {order.cliente} · {order.quantidade} un.
                  </option>
                ))}
              </datalist>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={!sharedWmsClient || savingNew || ordersLoading || (Boolean(matchedOrder) && !isOrderPrefilled) || !orderNumber.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {savingNew ? 'Criando...' : 'Criar controle'}
              </button>
            </div>
          </div>
          {ordersLoading && <p className="text-[11px] text-slate-500">Carregando pedidos para preenchimento automático...</p>}
          {orderLoadError && <p className="text-[11px] text-amber-700">{orderLoadError}</p>}
          {!ordersLoading && orderNumber.trim() && isOrderPrefilled && (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="text-xs font-semibold text-emerald-800">
                Pedido encontrado. Confira ou edite os dados antes de criar.
              </p>
              <HeaderField label="Nome do cliente" value={clientName} onChange={setClientName} />
              <OrderDetailsFields details={orderDetails} onChange={setOrderDetails} />
            </div>
          )}
          {!ordersLoading && orderNumber.trim() && !matchedOrder && (
            <p className="text-xs text-amber-700">
              Pedido não localizado na lista. O controle será criado com o número informado; você poderá completar os dados depois.
            </p>
          )}
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Pedidos em separação</h2>
            <p className="text-[11px] text-slate-500">{records.length} pedido(s) · {totalEquipment} equipamento(s) registrados</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pedido, cliente, serial ou CCID" className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-xs outline-none focus:border-blue-500" />
          </label>
        </div>

        {loading ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Carregando separações...</p>
        ) : visibleRecords.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {records.length ? 'Nenhum pedido corresponde à busca.' : 'Nenhum controle de separação cadastrado.'}
          </p>
        ) : (
          visibleRecords.map((record) => (
            <SeparationCard key={record.id} record={record} onSave={saveRecord} onDelete={removeRecord} />
          ))
        )}
      </section>
    </div>
  );
}
