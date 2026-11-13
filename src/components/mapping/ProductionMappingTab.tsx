import React, { useState, useEffect, useMemo } from 'react';
import {
  EquipmentStockValues,
  OrderItem,
  SemPedidoEntry,
  EquipmentDeliveryEntry,
  CalculatedItemRow,
  GroupSummary,
  ItemGroup,
  MappingCustomColumn,
  MappingLayoutColumn,
  EquipmentItem,
  ChipReportRow,
} from '../../types/mapping';
import { BaseOrder } from '../../types/orders';
import { ProductionOrder } from '../../types/production';
import {
  EQUIPMENT_ITEMS,
  INITIAL_STOCK_VALUES,
  INITIAL_ORDERS,
  INITIAL_SEM_PEDIDO,
  INITIAL_DELIVERIES,
} from '../../data/initialData';
import { TopInventoryTable } from './TopInventoryTable';
import {
  syncMappingToProductionOrders,
  linkBaseOrderToMapping,
  STORAGE_KEYS,
} from '../../services/productionSyncService';
import { loadOrdersFromGoogleSheet } from '../../services/googleSheetOrders';
import {
  RotateCcw,
  Download,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ArrowRight,
  Factory,
} from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import { loadAttendedOrderNumbers } from '../../services/googleSheetOrders';
import { downloadMappingExcel } from '../../utils/mappingExcelExport';

const STORAGE_KEY = 'kiraso_production_mapping_v1';
const CHIP_REPORT_STORAGE_KEY = `${STORAGE_KEY}_chips`;
const HIDDEN_ITEMS_STORAGE_KEY = `${STORAGE_KEY}_hidden_items`;
const STOCK_DEFAULTS_VERSION = '2026-09-21-balances-01';

const INITIAL_CHIP_REPORT_ROWS: ChipReportRow[] = [
  { operadora: 'ESEYE', saldoFisico: 943, comPedido: 1167, semPedido: 0, entregueProducao: 526 },
  { operadora: 'CLARO', saldoFisico: 630, comPedido: 0, semPedido: 0, entregueProducao: 0 },
  { operadora: 'VIVO', saldoFisico: 385, comPedido: 0, semPedido: 0, entregueProducao: 0 },
  { operadora: 'ALLCOM', saldoFisico: 0, comPedido: 0, semPedido: 0, entregueProducao: 0 },
];

const DEFAULT_LAYOUT_COLUMNS: MappingLayoutColumn[] = [
  { id: 'isca-2g', title: 'Isca 2G', group: 'ISCA 2G', itemIds: EQUIPMENT_ITEMS.filter((item) => item.group === 'ISCA 2G').map((item) => item.id), locked: true },
  { id: 'isca-4g', title: 'Isca 4G', group: 'ISCA 4G', itemIds: EQUIPMENT_ITEMS.filter((item) => item.group === 'ISCA 4G').map((item) => item.id), locked: true },
  { id: 'tags', title: 'Tags', group: 'TAGS', itemIds: EQUIPMENT_ITEMS.filter((item) => item.group === 'TAGS').map((item) => item.id), locked: true },
  { id: 'rastreadores', title: 'Rastreadores', group: 'RASTREADORES', itemIds: EQUIPMENT_ITEMS.filter((item) => item.group === 'RASTREADORES').map((item) => item.id), locked: true },
  { id: 'indisponivel', title: 'Indisponível', group: 'INDISPONÍVEL', itemIds: EQUIPMENT_ITEMS.filter((item) => item.group === 'INDISPONÍVEL').map((item) => item.id), locked: true },
];

interface ProductionMappingTabProps {
  onNavigateToProduction?: () => void;
}

export const ProductionMappingTab: React.FC<ProductionMappingTabProps> = ({
  onNavigateToProduction,
}) => {
  // Local storage loaded state
  const [stockValues, setStockValues] = useState<Record<string, EquipmentStockValues>>(() => {
    try {
      if (localStorage.getItem(`${STORAGE_KEY}_stocks_version`) !== STOCK_DEFAULTS_VERSION) {
        localStorage.setItem(`${STORAGE_KEY}_stocks_version`, STOCK_DEFAULTS_VERSION);
        localStorage.setItem(`${STORAGE_KEY}_stocks`, JSON.stringify(INITIAL_STOCK_VALUES));
        return INITIAL_STOCK_VALUES;
      }
      const saved = localStorage.getItem(`${STORAGE_KEY}_stocks`);
      return saved ? JSON.parse(saved) : INITIAL_STOCK_VALUES;
    } catch {
      return INITIAL_STOCK_VALUES;
    }
  });

  const [orders, setOrders] = useState<OrderItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_orders`);
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [semPedidoEntries, setSemPedidoEntries] = useState<SemPedidoEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_sem_pedido`);
      return saved ? JSON.parse(saved) : INITIAL_SEM_PEDIDO;
    } catch {
      return INITIAL_SEM_PEDIDO;
    }
  });

  const [chipReportRows, setChipReportRows] = useState<ChipReportRow[]>(() => {
    try {
      const saved = localStorage.getItem(CHIP_REPORT_STORAGE_KEY);
      if (!saved) return INITIAL_CHIP_REPORT_ROWS;
      const parsed = JSON.parse(saved) as ChipReportRow[];
      return INITIAL_CHIP_REPORT_ROWS.map((initialRow) => {
        const savedRow = parsed.find((row) => row.operadora === initialRow.operadora);
        return savedRow ? {
          ...initialRow,
          saldoFisico: Number(savedRow.saldoFisico) || 0,
          comPedido: Number(savedRow.comPedido) || 0,
          semPedido: Number(savedRow.semPedido) || 0,
          entregueProducao: Number(savedRow.entregueProducao) || 0,
        } : initialRow;
      });
    } catch {
      return INITIAL_CHIP_REPORT_ROWS;
    }
  });

  const [deliveries, setDeliveries] = useState<EquipmentDeliveryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_deliveries`);
      return saved ? JSON.parse(saved) : INITIAL_DELIVERIES;
    } catch {
      return INITIAL_DELIVERIES;
    }
  });

  const [itemNameOverrides, setItemNameOverrides] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${STORAGE_KEY}_item_names`) || '{}');
    } catch {
      return {};
    }
  });

  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(HIDDEN_ITEMS_STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });

  const [layoutColumns, setLayoutColumns] = useState<MappingLayoutColumn[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${STORAGE_KEY}_layout`) || 'null') || DEFAULT_LAYOUT_COLUMNS;
    } catch {
      return DEFAULT_LAYOUT_COLUMNS;
    }
  });

  const [customColumns, setCustomColumns] = useState<MappingCustomColumn[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${STORAGE_KEY}_columns`) || '[]');
    } catch {
      return [];
    }
  });

  const [customColumnValues, setCustomColumnValues] = useState<Record<string, Record<string, number>>>({});

  const [extraItems, setExtraItems] = useState<EquipmentItem[]>(() => {
    try {
      const savedExtra = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_extra_items`) || '[]') as EquipmentItem[];
      const catalog = JSON.parse(localStorage.getItem('kiraso_catalog_items_v1') || '[]') as Array<{ id: number; name: string; familia: string; vinculo: string }>;
      const catalogItems: EquipmentItem[] = catalog
        .filter((item) => item.vinculo === 'Pendente de vínculo')
        .map((item) => ({
          id: `catalog-${item.id}`,
          name: item.name,
          group: item.familia === 'Rastreadores' ? 'RASTREADORES' : item.familia === 'Tags' ? 'TAGS' : item.familia === 'Iscas' ? 'ISCA 4G' : 'INDISPONÍVEL',
        }));
      return [...savedExtra.filter((item) => !catalogItems.some((catalogItem) => catalogItem.id === item.id)), ...catalogItems];
    } catch {
      return [];
    }
  });

  const [notification, setNotification] = useState<{
    msg: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Auto save to LocalStorage and sync with Production Orders
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_stocks`, JSON.stringify(stockValues));
      localStorage.setItem(`${STORAGE_KEY}_orders`, JSON.stringify(orders));
      localStorage.setItem(`${STORAGE_KEY}_sem_pedido`, JSON.stringify(semPedidoEntries));
      localStorage.setItem(`${STORAGE_KEY}_deliveries`, JSON.stringify(deliveries));
      localStorage.setItem(`${STORAGE_KEY}_item_names`, JSON.stringify(itemNameOverrides));
      localStorage.setItem(`${STORAGE_KEY}_layout`, JSON.stringify(layoutColumns));
      localStorage.setItem(`${STORAGE_KEY}_columns`, JSON.stringify(customColumns));
      localStorage.setItem(`${STORAGE_KEY}_extra_items`, JSON.stringify(extraItems));
      localStorage.setItem(HIDDEN_ITEMS_STORAGE_KEY, JSON.stringify(hiddenItemIds));
      localStorage.setItem(CHIP_REPORT_STORAGE_KEY, JSON.stringify(chipReportRows));

      // Synchronize with Ordens de Produção ("A atender" panel)
      syncMappingToProductionOrders(orders, deliveries);
      window.dispatchEvent(new CustomEvent('kiraso_mapping_state_sync'));
    } catch (err) {
      console.error('Falha ao salvar no localStorage:', err);
    }
  }, [stockValues, orders, semPedidoEntries, deliveries, itemNameOverrides, layoutColumns, customColumns, customColumnValues, extraItems, hiddenItemIds, chipReportRows]);

  useEffect(() => {
    const reloadMappingOrders = () => {
      try {
        const saved = localStorage.getItem(`${STORAGE_KEY}_orders`);
        setOrders(saved ? JSON.parse(saved) : []);
      } catch (error) {
        console.error('Falha ao atualizar pedidos do mapeamento:', error);
      }
    };
    window.addEventListener('kiraso_mapping_sync', reloadMappingOrders);
    window.addEventListener('storage', reloadMappingOrders);
    return () => {
      window.removeEventListener('kiraso_mapping_sync', reloadMappingOrders);
      window.removeEventListener('storage', reloadMappingOrders);
    };
  }, []);

  useEffect(() => {
    const syncCatalogItems = () => {
      try {
        const catalog = JSON.parse(localStorage.getItem('kiraso_catalog_items_v1') || '[]') as Array<{ id: number; name: string; familia: string; vinculo: string }>;
        const pendingItems: EquipmentItem[] = catalog.filter((item) => item.vinculo === 'Pendente de vínculo').map((item) => ({
          id: `catalog-${item.id}`,
          name: item.name,
          group: item.familia === 'Rastreadores' ? 'RASTREADORES' : item.familia === 'Tags' ? 'TAGS' : item.familia === 'Iscas' ? 'ISCA 4G' : 'INDISPONÍVEL',
        }));
        setExtraItems((current) => [...current.filter((item) => !item.id.startsWith('catalog-')), ...pendingItems]);
      } catch (error) {
        console.error('Falha ao sincronizar itens cadastrados:', error);
      }
    };
    window.addEventListener('kiraso_catalog_sync', syncCatalogItems);
    return () => window.removeEventListener('kiraso_catalog_sync', syncCatalogItems);
  }, []);

  useEffect(() => {
    if (!extraItems.length) return;
    setLayoutColumns((current) => {
      const assigned = new Set(current.flatMap((column) => column.itemIds));
      const missing = extraItems.map((item) => item.id).filter((id) => !assigned.has(id));
      if (!missing.length) return current;
      const pendingId = 'pending-link';
      const hasPending = current.some((column) => column.id === pendingId);
      if (hasPending) return current.map((column) => column.id === pendingId ? { ...column, itemIds: [...column.itemIds, ...missing] } : column);
      return [...current, { id: pendingId, title: 'Pendente de vínculo', itemIds: missing }];
    });
  }, [extraItems]);

  const showNotification = (
    msg: string,
    actionLabel?: string,
    onAction?: () => void
  ) => {
    setNotification({ msg, actionLabel, onAction });
    setTimeout(() => setNotification(null), 5000);
  };

  // -------------------------------------------------------------
  // CALCULATION ENGINE: Top Table Real-time Formula Resolution
  // -------------------------------------------------------------
  const calculatedRows: CalculatedItemRow[] = useMemo(() => {
    return [...EQUIPMENT_ITEMS, ...extraItems].map((baseItem) => {
      const item = {
        ...baseItem,
        name: itemNameOverrides[baseItem.id] || baseItem.name,
      };
      // 1. Comprometidas com pedido = sum of active orders matching this item
      const comPedido = orders
        .filter((o) => o.itemId === item.id)
        .reduce((sum, o) => sum + (Number(o.quantidade) || 0), 0);

      // 2. Comprometidas Sem pedido = sum of quantities in bottom-right "Sem pedido" box matching this item
      const semPedido = semPedidoEntries
        .filter((sp) => sp.itemId === item.id)
        .reduce((sum, sp) => sum + (Number(sp.quantidade) || 0), 0);

      // 3. User manual inputs from stockValues
      const itemStock = stockValues[item.id] || { fisico: 0, quantidade: 0, emManutencao: 0, compraRealizada: 0 };
      const fisico = Number(itemStock.fisico) || 0;
      const emManutencao = Number(itemStock.emManutencao) || 0;
      const compraRealizada = Number(itemStock.compraRealizada) || 0;

      // 4. Saldo Real = Físico - Com pedido - Sem pedido
      const saldoReal = fisico - comPedido - semPedido;

      // 5. Saldo pós Entrega = Saldo Real + Em Manutenção + Compra realizada
      const saldoPosEntrega = saldoReal + emManutencao + compraRealizada;

      return {
        item,
        fisico,
        quantidade: itemStock.quantidade ?? fisico,
        comPedido,
        semPedido,
        saldoReal,
        emManutencao,
        compraRealizada,
        saldoPosEntrega,
      };
    });
  }, [orders, semPedidoEntries, stockValues, itemNameOverrides, extraItems]);

  const visibleCalculatedRows = useMemo(
    () => calculatedRows.filter((row) => !hiddenItemIds.includes(row.item.id)),
    [calculatedRows, hiddenItemIds]
  );

  // Group Totals Calculation
  const groupSummaries = useMemo(() => {
    const groups: ItemGroup[] = ['ISCA 2G', 'ISCA 4G', 'TAGS', 'RASTREADORES', 'INDISPONÍVEL'];
    const summaries: Record<string, GroupSummary> = {};

    groups.forEach((grp) => {
      const itemsInGrp = visibleCalculatedRows.filter((r) => r.item.group === grp);
      summaries[grp] = itemsInGrp.reduce(
        (acc, curr) => ({
          group: grp,
          title: `TOTAL ${grp}`,
          fisico: acc.fisico + curr.fisico,
          comPedido: acc.comPedido + curr.comPedido,
          semPedido: acc.semPedido + curr.semPedido,
          saldoReal: acc.saldoReal + curr.saldoReal,
          emManutencao: acc.emManutencao + curr.emManutencao,
          compraRealizada: acc.compraRealizada + curr.compraRealizada,
          saldoPosEntrega: acc.saldoPosEntrega + curr.saldoPosEntrega,
        }),
        {
          group: grp,
          title: `TOTAL ${grp}`,
          fisico: 0,
          comPedido: 0,
          semPedido: 0,
          saldoReal: 0,
          emManutencao: 0,
          compraRealizada: 0,
          saldoPosEntrega: 0,
        }
      );
    });

    return summaries;
  }, [visibleCalculatedRows]);

  // Small Panel "Pedidos Em Abertos (Painel)"
  const painelAbertos = useMemo(() => {
    return {
      iscas2G: groupSummaries['ISCA 2G']?.comPedido ?? 0,
      iscas4G: groupSummaries['ISCA 4G']?.comPedido ?? 0,
      tags: groupSummaries['TAGS']?.comPedido ?? 0,
      rastreadores: groupSummaries['RASTREADORES']?.comPedido ?? 0,
    };
  }, [groupSummaries]);

  // -------------------------------------------------------------
  // Handlers for Editable Top Table Fields
  // -------------------------------------------------------------
  const handleStockChange = (
    itemId: string,
    field: 'fisico' | 'quantidade' | 'emManutencao' | 'compraRealizada',
    value: number
  ) => {
    setStockValues((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { fisico: 0, emManutencao: 0, compraRealizada: 0 }),
        [field]: value,
      },
    }));
  };

  // Link Base Order from Database
  const handleLinkBaseOrder = (baseOrder: BaseOrder, targetItemId: string) => {
    const { orderItem, productionOrder } = linkBaseOrderToMapping(baseOrder);
    orderItem.itemId = targetItemId;

    const newOrd: OrderItem = {
      ...orderItem,
      id: `ord-${Date.now()}`,
    };

    setOrders((prev) => [newOrd, ...prev]);

    // Ensure OP in Ordens de Produção
    try {
      const rawOps = localStorage.getItem(STORAGE_KEYS.PENDING_OPS);
      const ops: ProductionOrder[] = rawOps ? JSON.parse(rawOps) : [];
      const exists = ops.some(
        (o) => o.pedido.toLowerCase() === baseOrder.numPedido.toLowerCase()
      );
      if (!exists) {
        ops.unshift(productionOrder);
        localStorage.setItem(STORAGE_KEYS.PENDING_OPS, JSON.stringify(ops));
        window.dispatchEvent(
          new CustomEvent('kiraso_orders_sync', { detail: { updatedOps: ops } })
        );
      }
    } catch (e) {
      console.error(e);
    }

    showNotification(
      `Pedido ${baseOrder.numPedido} vinculado ao Mapeamento e registrado na fila de Produção!`,
      onNavigateToProduction ? 'Ver na Produção' : undefined,
      onNavigateToProduction
    );
  };

  // -------------------------------------------------------------
  // Handlers for "Sem Pedido" (Bottom-Right Special Box)
  // -------------------------------------------------------------
  const handleAddSemPedido = (newEntry: Omit<SemPedidoEntry, 'id'>) => {
    const entry: SemPedidoEntry = {
      ...newEntry,
      id: `sp-${Date.now()}`,
    };
    setSemPedidoEntries((prev) => [...prev, entry]);
    const item = EQUIPMENT_ITEMS.find((i) => i.id === entry.itemId);
    showNotification(`${entry.quantidade} unid. adicionadas em Sem Pedido (${item?.name || ''})!`);
  };

  const handleUpdateSemPedido = (id: string, updates: Partial<SemPedidoEntry>) => {
    setSemPedidoEntries((prev) => prev.map((sp) => (sp.id === id ? { ...sp, ...updates } : sp)));
  };

  const handleDeleteSemPedido = (id: string) => {
    setSemPedidoEntries((prev) => prev.filter((sp) => sp.id !== id));
  };

  // -------------------------------------------------------------
  // Handlers for Equipment Deliveries (Bottom-Right Cards)
  // -------------------------------------------------------------
  const handleUpdateDelivery = (id: string, updates: Partial<EquipmentDeliveryEntry>) => {
    setDeliveries((prev) => {
      const current = prev.find((delivery) => delivery.id === id);
      if (!current || updates.quantidade === undefined || !current.linkedOrderId) {
        return prev.map((delivery) => (delivery.id === id ? { ...delivery, ...updates } : delivery));
      }
      const linkedOrder = orders.find((order) => order.id === current.linkedOrderId);
      if (!linkedOrder) return prev.map((delivery) => (delivery.id === id ? { ...delivery, ...updates } : delivery));
      const usedByOtherLines = prev
        .filter((delivery) => delivery.id !== id && (delivery.linkedOrderId === linkedOrder.id || delivery.linkedOrderNumber?.toLowerCase() === linkedOrder.numPed.toLowerCase()))
        .reduce((sum, delivery) => sum + delivery.quantidade, 0);
      const allowed = Math.max(0, linkedOrder.quantidade - usedByOtherLines);
      return prev.map((delivery) => (delivery.id === id ? { ...delivery, ...updates, quantidade: Math.min(updates.quantidade || 0, allowed) } : delivery));
    });
  };

  const handleDeleteDelivery = (id: string) => {
    setDeliveries((prev) => prev.filter((d) => d.id !== id));
  };

  const handleRenameItem = (itemId: string, name: string) => {
    setItemNameOverrides((prev) => ({ ...prev, [itemId]: name }));
    showNotification('Nome do item atualizado.');
  };

  const handleMoveItem = (itemId: string, targetColumnId: string) => {
    setLayoutColumns((prev) => prev.map((column) => ({
      ...column,
      itemIds: column.id === targetColumnId
        ? [...column.itemIds.filter((id) => id !== itemId), itemId]
        : column.itemIds.filter((id) => id !== itemId),
    })));
    showNotification('Item movido para a janela selecionada.');
  };

  const handleAddLayoutColumn = (title: string) => {
    setLayoutColumns((prev) => [...prev, { id: `layout-${Date.now()}`, title, itemIds: [] }]);
    showNotification(`Janela "${title}" criada.`);
  };

  const handleDeleteLayoutColumn = (columnId: string) => {
    setLayoutColumns((prev) => {
      const removed = prev.find((column) => column.id === columnId);
      const fallback = prev.find((column) => column.id !== columnId);
      if (!removed || removed.locked || !fallback) return prev;
      return prev.filter((column) => column.id !== columnId).map((column) => column.id === fallback.id ? { ...column, itemIds: [...column.itemIds, ...removed.itemIds] } : column);
    });
  };

  const handleAddCustomColumn = (title: string) => {
    setCustomColumns((prev) => [...prev, { id: `field-${Date.now()}`, title }]);
  };

  const handleAddItem = (name: string, targetColumnId: string) => {
    const id = `item-${Date.now()}`;
    const item: EquipmentItem = { id, name, group: 'INDISPONÍVEL' };
    setExtraItems((prev) => [...prev, item]);
    setStockValues((prev) => ({ ...prev, [id]: { fisico: 0, quantidade: 0, emManutencao: 0, compraRealizada: 0 } }));
    setLayoutColumns((prev) => prev.map((column) => column.id === targetColumnId ? { ...column, itemIds: [...column.itemIds, id] } : column));
    showNotification(`Item "${name}" adicionado ao quadro.`);
  };

  const handleDeleteItem = (itemId: string) => {
    const item = calculatedRows.find((row) => row.item.id === itemId)?.item;
    if (!item || hiddenItemIds.includes(itemId)) return;
    if (!window.confirm(`Remover "${item.name}" do quadro? Os pedidos e o histórico serão preservados.`)) return;

    setHiddenItemIds((current) => current.includes(itemId) ? current : [...current, itemId]);
    showNotification(`"${item.name}" foi removido do quadro. O histórico foi preservado.`);
  };

  const handleRestoreItem = (itemId: string) => {
    setHiddenItemIds((current) => current.filter((id) => id !== itemId));
  };

  const handleChipReportChange = (
    operadora: string,
    field: Exclude<keyof ChipReportRow, 'operadora'>,
    value: number
  ) => {
    setChipReportRows((current) => current.map((row) => (
      row.operadora === operadora ? { ...row, [field]: value } : row
    )));
  };

  const handleExportExcel = async () => {
    try {
      await downloadMappingExcel({
        rows: visibleCalculatedRows,
        layoutColumns,
        customColumns,
        customColumnValues,
        chipReportRows,
      });
      showNotification('Arquivo Excel gerado com o mapeamento e o relatório de chips.');
    } catch (exportError) {
      console.error('Falha ao exportar o mapeamento para Excel:', exportError);
      showNotification('Não foi possível gerar o arquivo Excel.');
    }
  };

  const handleCustomValueChange = (columnId: string, itemId: string, value: number) => {
    setCustomColumnValues((prev) => ({ ...prev, [columnId]: { ...prev[columnId], [itemId]: value } }));
  };

  useEffect(() => {
    let active = true;
    Promise.all([loadOrdersFromGoogleSheet(), loadAttendedOrderNumbers()]).then(([sheetOrders, attendedNumbers]) => {
      if (!active || sheetOrders.length === 0) return;
      setOrders((current) => {
        const currentByNumber = new Map(current.map((order) => [order.numPed.trim().toLowerCase(), order]));
        const sourceOrders = sheetOrders
          .filter((source) => !attendedNumbers.has(source.numPedido.trim().toLowerCase()))
          .map((source) => {
            const existing = currentByNumber.get(source.numPedido.trim().toLowerCase());
            const importedOrder = {
              id: `sheet-${source.id}`,
              numPed: source.numPedido,
              cliente: source.cliente,
              quantidade: source.quantidade,
              itemId: source.mappedItemId,
              dataEnvio: source.dataEnvio,
              modeloDesc: `${source.geracao || ''} ${source.modeloVariacao || ''}`.trim(),
              tipoNegocio: source.tipoNegocio,
              observacao: source.observacao,
            };
            return existing ? { ...existing, ...importedOrder, id: existing.id } : importedOrder;
          });
        const manualOrders = current.filter((order) => order.id.startsWith('ord-') && !sheetOrders.some((source) => source.numPedido.trim().toLowerCase() === order.numPed.trim().toLowerCase()));
        return [...sourceOrders, ...manualOrders];
      });
    }).catch((error) => console.warn('Importação da planilha de pedidos indisponível:', error));
    return () => { active = false; };
  }, []);

  // Reset to original spreadsheet sample data
  const handleResetToDefaults = () => {
    if (window.confirm('Deseja restaurar todos os valores para o modelo original da planilha?')) {
      setStockValues(INITIAL_STOCK_VALUES);
      setOrders(INITIAL_ORDERS);
      setSemPedidoEntries(INITIAL_SEM_PEDIDO);
      setDeliveries(INITIAL_DELIVERIES);
      setChipReportRows(INITIAL_CHIP_REPORT_ROWS);
      setItemNameOverrides({});
      setLayoutColumns(DEFAULT_LAYOUT_COLUMNS);
      setCustomColumns([]);
      setCustomColumnValues({});
      setExtraItems([]);
      localStorage.removeItem(`${STORAGE_KEY}_stocks`);
      localStorage.removeItem(`${STORAGE_KEY}_orders`);
      localStorage.removeItem(`${STORAGE_KEY}_sem_pedido`);
      localStorage.removeItem(`${STORAGE_KEY}_deliveries`);
      localStorage.removeItem(`${STORAGE_KEY}_item_names`);
      localStorage.removeItem(`${STORAGE_KEY}_layout`);
      localStorage.removeItem(`${STORAGE_KEY}_columns`);
      localStorage.removeItem(`${STORAGE_KEY}_extra_items`);
      localStorage.removeItem(CHIP_REPORT_STORAGE_KEY);
      showNotification('Mapeamento restaurado para os dados originais da planilha!');
    }
  };

  // Export to JSON backup
  const handleExportData = () => {
    const data = {
      stockValues,
      orders,
      semPedidoEntries,
      deliveries,
      chipReportRows,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapeamento_producao_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // KPI calculations
  const totalFisico = visibleCalculatedRows.reduce((acc, r) => acc + r.fisico, 0);
  const totalComPedido = visibleCalculatedRows.reduce((acc, r) => acc + r.comPedido, 0);
  const totalSemPedido = visibleCalculatedRows.reduce((acc, r) => acc + r.semPedido, 0);
  const totalSaldoReal = visibleCalculatedRows.reduce((acc, r) => acc + r.saldoReal, 0);
  const totalPosEntrega = visibleCalculatedRows.reduce((acc, r) => acc + r.saldoPosEntrega, 0);
  const chipReportTotals = chipReportRows.reduce((total, row) => ({
    saldoFisico: total.saldoFisico + row.saldoFisico,
    comPedido: total.comPedido + row.comPedido,
    semPedido: total.semPedido + row.semPedido,
    entregueProducao: total.entregueProducao + row.entregueProducao,
  }), { saldoFisico: 0, comPedido: 0, semPedido: 0, entregueProducao: 0 });

  return (
    <div className="w-full space-y-4">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification.msg}</span>
          </div>
          {notification.actionLabel && notification.onAction && (
            <button
              onClick={notification.onAction}
              className="inline-flex items-center gap-1 font-bold text-emerald-800 underline hover:text-emerald-950"
            >
              {notification.actionLabel}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Mapeamento Online de Produção
              </h1>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
                Planilha Ativa & Sincronizada
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Preenchimento interativo com cálculo em tempo real de saldo físico, pedidos e sincronização com Ordens de Produção
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToProduction && (
            <button
              onClick={onNavigateToProduction}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#172554] shadow-xs active:scale-95 transition-all"
            >
              <Factory className="h-3.5 w-3.5 text-white" />
              <span>Painel Ordens de Produção</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleExportExcel()}
            title="Baixar o mapeamento e o mini-relatório de chips em Excel"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Baixar Excel</span>
          </button>
          <button
            onClick={handleExportData}
            title="Exportar backup dos dados atuais em JSON"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Exportar Dados</span>
          </button>
          <button
            onClick={handleResetToDefaults}
            title="Restaurar para os dados originais da planilha"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-red-700 shadow-xs transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Restaurar Padrão</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Total Físico em Estoque</div>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono">
            {totalFisico.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] text-slate-400">Contagem de bancada</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Comprometidas c/ Pedido</div>
          <div className="mt-1 text-xl font-bold text-blue-700 font-mono">
            {totalComPedido.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] text-slate-400">Total de pedidos ativos</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Comprometidas s/ Pedido</div>
          <div className="mt-1 text-xl font-bold text-purple-700 font-mono">
            {totalSemPedido.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] text-slate-400">Soma Card Sem Pedido</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Saldo Real Disponível</div>
          <div className={`mt-1 text-xl font-bold font-mono ${totalSaldoReal < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {totalSaldoReal.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] text-slate-400">Físico − Comprometidas</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[11px] font-medium text-slate-500">Projeção Pós Entrega</div>
          <div className="mt-1 text-xl font-bold text-blue-900 font-mono">
            {totalPosEntrega.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] text-slate-400">+ Manutenção + Compras</div>
        </div>
      </div>

      {/* 1. TABELA SUPERIOR: Mapeamento Principal de Estoque */}
      <section aria-label="Tabela Superior de Estoque">
        <TopInventoryTable
          rows={visibleCalculatedRows}
          hiddenItems={calculatedRows
            .filter((row) => hiddenItemIds.includes(row.item.id))
            .map((row) => row.item)}
          groupSummaries={groupSummaries}
          painelAbertos={painelAbertos}
          onStockChange={handleStockChange}
          onItemNameChange={handleRenameItem}
          layoutColumns={layoutColumns}
          customColumns={customColumns}
          customColumnValues={customColumnValues}
          onMoveItem={handleMoveItem}
          onAddLayoutColumn={handleAddLayoutColumn}
          onDeleteLayoutColumn={handleDeleteLayoutColumn}
          onAddCustomColumn={handleAddCustomColumn}
          onCustomValueChange={handleCustomValueChange}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onRestoreItem={handleRestoreItem}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">Mini relatório de chips</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Saldo real = físico − comprometidas + entregues na Produção. Os campos são editáveis e salvos automaticamente neste navegador.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#0e2a47] text-[10px] font-semibold uppercase tracking-wide text-white">
                <th className="border-r border-slate-500 px-3 py-2 text-left">Operadora</th>
                <th className="border-r border-slate-500 px-2 py-2 text-center">Saldo físico</th>
                <th className="border-r border-slate-500 px-2 py-2 text-center">Comprometidas com pedido</th>
                <th className="border-r border-slate-500 px-2 py-2 text-center">Comprometidas sem pedido</th>
                <th className="border-r border-slate-500 px-2 py-2 text-center">Entregues na Produção</th>
                <th className="px-2 py-2 text-center">Saldo disponível real</th>
              </tr>
            </thead>
            <tbody>
              {chipReportRows.map((row) => {
                const saldoReal = row.saldoFisico - row.comPedido - row.semPedido + row.entregueProducao;
                const numericFields: Array<{
                  key: Exclude<keyof ChipReportRow, 'operadora'>;
                  value: number;
                }> = [
                  { key: 'saldoFisico', value: row.saldoFisico },
                  { key: 'comPedido', value: row.comPedido },
                  { key: 'semPedido', value: row.semPedido },
                  { key: 'entregueProducao', value: row.entregueProducao },
                ];
                return (
                  <tr key={row.operadora} className="border-b border-slate-200 text-slate-800">
                    <td className="px-3 py-2 font-semibold">{row.operadora}</td>
                    {numericFields.map(({ key, value }) => (
                      <td key={key} className="border-l border-slate-100 px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={value}
                          aria-label={`${row.operadora} ${key}`}
                          onChange={(event) => handleChipReportChange(
                            row.operadora,
                            key,
                            Number(event.target.value) || 0
                          )}
                          className="w-full rounded border border-transparent bg-amber-50/60 px-1 py-1 text-center font-mono font-semibold outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white"
                        />
                      </td>
                    ))}
                    <td className={`border-l border-slate-100 px-2 py-2 text-center font-mono font-bold ${saldoReal < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
                      {saldoReal}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-blue-100/70 font-bold text-slate-900">
                <td className="px-3 py-2">TOTAL CHIPS</td>
                <td className="px-2 py-2 text-center">{chipReportTotals.saldoFisico}</td>
                <td className="px-2 py-2 text-center">{chipReportTotals.comPedido}</td>
                <td className="px-2 py-2 text-center">{chipReportTotals.semPedido}</td>
                <td className="px-2 py-2 text-center">{chipReportTotals.entregueProducao}</td>
                <td className="px-2 py-2 text-center">
                  {chipReportTotals.saldoFisico - chipReportTotals.comPedido -
                    chipReportTotals.semPedido + chipReportTotals.entregueProducao}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};
