import { OrderItem, EquipmentDeliveryEntry } from '../types/mapping';
import { ProductionOrder } from '../types/production';
import { BaseOrder } from '../types/orders';

/**
 * Key names in localStorage
 */
export const STORAGE_KEYS = {
  MAPPING: 'kiraso_production_mapping_v1',
  MAPPING_ORDERS: 'kiraso_production_mapping_v1_orders',
  MAPPING_STOCKS: 'kiraso_production_mapping_v1_stocks',
  MAPPING_SEM_PEDIDO: 'kiraso_production_mapping_v1_sem_pedido',
  MAPPING_DELIVERIES: 'kiraso_production_mapping_v1_deliveries',
  PENDING_OPS: 'kiraso_pending_ops',
  ACTIVE_OPS: 'kiraso_active_ops',
  SERIAL_UNITS: 'kiraso_serial_units',
};

/**
 * Calculates total equipment destined/delivered to an order based on:
 * 1. Explicit destinadoProducao
 * 2. Deliveries in bottom-right cards matching this order numPed or id
 * 3. entregueProducao flag (if true and no other count, defaults to full quantidade)
 */
export function calculateOrderDestinedQuantity(
  order: OrderItem,
  deliveries: EquipmentDeliveryEntry[]
): number {
  // Check matching delivery cards in bottom-right
  const matchingDeliveries = deliveries.filter((d) => {
    if (d.linkedOrderId && d.linkedOrderId === order.id) return true;
    const dest = (d.destinoOuPedido || '').toLowerCase();
    const ped = (order.numPed || '').toLowerCase();
    const cli = (order.cliente || '').toLowerCase();
    return d.linkedOrderNumber?.toLowerCase() === ped || dest.includes(ped) || (cli.length > 5 && dest.includes(cli.substring(0, 8)));
  });

  const deliverySum = matchingDeliveries.reduce((sum, d) => sum + (d.quantidade || 0), 0);
  if (deliverySum > 0) {
    return deliverySum;
  }

  if (typeof order.destinadoProducao === 'number' && order.destinadoProducao > 0) {
    return order.destinadoProducao;
  }

  // If marked as entregueProducao, count full order quantity
  if (order.entregueProducao) {
    return order.quantidade;
  }

  return 0;
}

/**
 * Syncs mapping orders and deliveries to pending production orders
 */
export function syncMappingToProductionOrders(
  mappingOrders: OrderItem[],
  deliveries: EquipmentDeliveryEntry[]
): void {
  try {
    const rawOps = localStorage.getItem(STORAGE_KEYS.PENDING_OPS);
    if (!rawOps) return;
    const ops: ProductionOrder[] = JSON.parse(rawOps);

    let hasChanges = false;

    const updatedOps = ops.map((op) => {
      // Find matching order in mapping
      const matched = mappingOrders.find((m) => {
        return (
          m.numPed.toLowerCase() === op.pedido.toLowerCase() ||
          (op.ordem && m.ordemProducaoId === op.ordem) ||
          (m.cliente && op.clienteSolicitante && m.cliente.toLowerCase().includes(op.clienteSolicitante.toLowerCase()))
        );
      });

      if (matched) {
        const destined = calculateOrderDestinedQuantity(matched, deliveries);
        if (op.destinado !== destined) {
          hasChanges = true;
          return {
            ...op,
            destinado: destined,
            // Keep observacoes updated with link info
            observacoes: op.observacoes?.includes('Mapeamento')
              ? op.observacoes
              : `${op.observacoes || ''} [Vinculado ao Mapeamento: ${matched.numPed}]`.trim(),
          };
        }
      }
      return op;
    });

    if (hasChanges) {
      localStorage.setItem(STORAGE_KEYS.PENDING_OPS, JSON.stringify(updatedOps));
      // Dispatch custom event for real-time reactivity without page reload
      window.dispatchEvent(new CustomEvent('kiraso_orders_sync', { detail: { updatedOps } }));
    }
  } catch (err) {
    console.error('Error syncing mapping to production:', err);
  }
}

/**
 * Converts a BaseOrder from the database into an OrderItem for Mapeamento
 * and ensures an OP is created in Ordens de Produção
 */
export function linkBaseOrderToMapping(baseOrder: BaseOrder): {
  orderItem: Omit<OrderItem, 'id'>;
  productionOrder: ProductionOrder;
} {
  const opCode = `OP-2026-00${Math.floor(100 + Math.random() * 900)}`;

  const orderItem: Omit<OrderItem, 'id'> = {
    numPed: baseOrder.numPedido,
    cliente: baseOrder.cliente,
    quantidade: baseOrder.quantidade,
    itemId: baseOrder.mappedItemId,
    entregueProducao: baseOrder.status === 'Destinado',
    destinadoProducao: baseOrder.destinadoProducao || 0,
    dataEnvio: baseOrder.dataEnvio,
    modeloDesc: `${baseOrder.geracao || ''} - ${baseOrder.corVariacao || baseOrder.modeloVariacao || ''}`.trim(),
    tipoNegocio: baseOrder.tipoNegocio,
    ordemProducaoId: opCode,
    observacao: baseOrder.observacao,
    dataSolicitacao: baseOrder.dataSolicitacao,
    cnpj: baseOrder.cnpj,
    comercial: baseOrder.comercial,
    contrato: baseOrder.contrato,
    tipoEntrega: baseOrder.tipoEntrega,
    tipoItem: baseOrder.tipoItem,
    operadora: baseOrder.operadora,
    geracao: baseOrder.geracao,
    modeloVariacao: baseOrder.modeloVariacao,
    corVariacao: baseOrder.corVariacao,
    carregador: baseOrder.carregador,
    quantidadeCarregador: baseOrder.quantidadeCarregador,
  };

  const productionOrder: ProductionOrder = {
    id: `op-${baseOrder.numPedido.replace(/[^a-zA-Z0-9]/g, '-')}`,
    prioridade: baseOrder.tipoNegocio === 'ASSISTÊNCIA' ? 'Crítica' : 'Padrão',
    ordem: opCode,
    origem: `Pedido de ${baseOrder.tipoNegocio}`,
    tipoOrigemBadge: baseOrder.tipoNegocio === 'VENDA' ? 'Fatura' : baseOrder.tipoNegocio,
    clienteSolicitante: baseOrder.cliente,
    pedido: baseOrder.numPedido,
    itemModel: `${baseOrder.mappedItemName} (${baseOrder.corVariacao || baseOrder.geracao || 'Padrão'})`,
    produzido: 0,
    falta: baseOrder.quantidade,
    totalQtd: baseOrder.quantidade,
    destinado: baseOrder.destinadoProducao || 0,
    dataCriacao: `${baseOrder.dataSolicitacao} 08:30`,
    status: 'A atender',
    bancada: 'Bancada 01',
    observacoes: `Equipamentos vinculados ao Mapeamento. ${baseOrder.observacao || ''}`.trim(),
  };

  return { orderItem, productionOrder };
}
