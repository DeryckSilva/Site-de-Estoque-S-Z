import { AttendedOrder } from '../types/attendedOrders';
import { ProductionOrder } from '../types/production';
import { OrderItem } from '../types/mapping';
import { INITIAL_ATTENDED_ORDERS } from '../data/attendedOrdersDatabase';
import initialSeedJson from '../data/attendedOrdersSeed.json';

export const ATTENDED_STORAGE_KEY = 'kiraso_attended_orders_v1';
export const PENDING_OPS_KEY = 'kiraso_pending_ops';
export const ACTIVE_OPS_KEY = 'kiraso_active_ops';
export const MAPPING_ORDERS_KEY = 'kiraso_production_mapping_v1_orders';

export interface FinalizeBaixaParams {
  numPedido: string;
  cliente: string;
  linhaProducao: string;
  comercial: string;
  contrato: string;
  operadora: string;
  geracao: string;
  modelo: string;
  quantidade: number;
  medidaCaixa: string;
  contemIscaLigada: 'SIM' | 'NÃO';
  idIscaLigada?: string;
  carregador?: 'SIM' | 'NÃO';
  quantidadeCarregador?: number | string;
  observacao?: string;
  origemOp?: string;
}

/**
 * Loads all attended orders from storage (or initializes with seeds)
 */
export function getAttendedOrders(): AttendedOrder[] {
  try {
    const raw = localStorage.getItem(ATTENDED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading attended orders from localStorage:', err);
  }

  // Combine initial attended orders with seed json
  const seedItems = (initialSeedJson as unknown as AttendedOrder[]) || [];
  const combined = [...INITIAL_ATTENDED_ORDERS];
  for (const s of seedItems) {
    if (!combined.some((c) => c.id === s.id || (c.numPedido && c.numPedido === s.numPedido))) {
      combined.push(s);
    }
  }

  try {
    localStorage.setItem(ATTENDED_STORAGE_KEY, JSON.stringify(combined));
  } catch (err) {
    console.error('Error seeding attended orders to localStorage:', err);
  }

  return combined;
}

/**
 * Saves attended orders array to localStorage
 */
export function saveAttendedOrders(orders: AttendedOrder[]): void {
  try {
    localStorage.setItem(ATTENDED_STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent('kiraso_attended_sync', { detail: { count: orders.length } }));
  } catch (err) {
    console.error('Error saving attended orders:', err);
  }
}

/**
 * Checks if an order was already attended / given baixa
 */
export function findOrderBaixa(numPedido: string): AttendedOrder | undefined {
  if (!numPedido) return undefined;
  const orders = getAttendedOrders();
  const cleanPed = numPedido.trim().toLowerCase();
  return orders.find(
    (o) =>
      o.numPedido.trim().toLowerCase() === cleanPed ||
      (o.id && o.id.toLowerCase().includes(cleanPed))
  );
}

/**
 * CORE FUNCTION:
 * Gives "Baixa" in the order.
 * 1. Appends record to Planilha de Baixa (attended orders)
 * 2. Updates the incoming orders sheet:
 *    - Updates "A atender" (decrementing falta or marking Concluído)
 *    - Updates Mapeamento Online (marks order as Atendido / Baixa realizada)
 *    - Dispatches events so all tabs react simultaneously!
 */
export function giveOrderBaixa(params: FinalizeBaixaParams): {
  success: boolean;
  attendedRecord: AttendedOrder;
  updatedPendingCount: number;
} {
  const now = new Date();
  const dateFormatted = now
    .toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(',', '');

  const newRecord: AttendedOrder = {
    id: `att-${params.numPedido.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
    adicionadoEm: dateFormatted,
    enderecoIp: '189.127.206.189',
    linhaProducao: params.linhaProducao || 'LINHA S-01',
    cliente: params.cliente,
    comercial: params.comercial || 'TIAGO',
    contrato: params.contrato || 'Descartável',
    operadora: params.operadora || 'ESEYE',
    geracao: params.geracao || 'ST - 8410 (NOVA)',
    modelo: params.modelo || 'PADRÃO (BRANCA)',
    quantidade: Number(params.quantidade) || 1,
    medidaCaixa: params.medidaCaixa || 'CAIXA 1 - 20x12x3',
    observacao: params.observacao || '',
    contemIscaLigada: params.contemIscaLigada || 'NÃO',
    idIscaLigada: params.idIscaLigada || '',
    numPedido: params.numPedido,
    carregador: params.carregador || 'NÃO',
    quantidadeCarregador: params.quantidadeCarregador || '',
    origemOp: params.origemOp || '',
    finalizadoPor: 'Deryck Silva (Produção)',
  };

  // 1. Save to Planilha de Baixa (at the very top)
  const currentAttended = getAttendedOrders();
  const updatedAttended = [newRecord, ...currentAttended];
  saveAttendedOrders(updatedAttended);

  // 2. Synchronize "A que cai pedidos" - Ordens de Produção ("A atender")
  let updatedPendingCount = 0;
  try {
    const rawOps = localStorage.getItem(PENDING_OPS_KEY);
    if (rawOps) {
      const ops: ProductionOrder[] = JSON.parse(rawOps);
      const cleanNum = params.numPedido.toLowerCase().trim();

      const updatedOps = ops
        .map((op) => {
          const match =
            op.pedido.toLowerCase().trim() === cleanNum ||
            (params.origemOp && op.ordem.toLowerCase() === params.origemOp.toLowerCase()) ||
            (op.clienteSolicitante && op.clienteSolicitante.toLowerCase() === params.cliente.toLowerCase());

          if (match) {
            const qtyProduced = Number(params.quantidade) || op.falta;
            const remaining = Math.max(0, op.falta - qtyProduced);
            const newProduced = op.produzido + qtyProduced;

            return {
              ...op,
              falta: remaining,
              produzido: newProduced,
              status: remaining === 0 ? ('Concluído' as const) : op.status,
              observacoes: `${op.observacoes || ''} [Baixa efetuada: ${newRecord.linhaProducao} / ${newRecord.medidaCaixa}]`.trim(),
            };
          }
          return op;
        })
        .filter((op) => op.falta > 0); // If completely fulfilled, clear from "A atender" queue

      updatedPendingCount = updatedOps.length;
      localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(updatedOps));
    }
  } catch (err) {
    console.error('Error updating pending ops on baixa:', err);
  }

  // 3. Synchronize "Mapeamento de Produção" (comprometidas com pedido)
  try {
    const rawMapping = localStorage.getItem(MAPPING_ORDERS_KEY);
    if (rawMapping) {
      const mappingOrders: OrderItem[] = JSON.parse(rawMapping);
      const cleanNum = params.numPedido.toLowerCase().trim();

      // A baixa encerra o pedido no fluxo operacional. O histórico oficial é
      // `ATTENDED_STORAGE_KEY`; portanto, o pedido não permanece em Comprometidas.
      const updatedMapping = mappingOrders.filter(
        (m) => m.numPed.toLowerCase().trim() !== cleanNum
      );

      localStorage.setItem(MAPPING_ORDERS_KEY, JSON.stringify(updatedMapping));
    }
  } catch (err) {
    console.error('Error updating mapping orders on baixa:', err);
  }

  // Dispatch unified event so any UI component updates immediately
  window.dispatchEvent(
    new CustomEvent('kiraso_orders_sync', {
      detail: {
        type: 'BAIXA_REALIZADA',
        attendedRecord: newRecord,
      },
    })
  );
  window.dispatchEvent(new CustomEvent('kiraso_mapping_sync'));

  return {
    success: true,
    attendedRecord: newRecord,
    updatedPendingCount,
  };
}

/**
 * Quick stats for Dashboard and Planilha de Baixas
 */
export function getAttendedStats() {
  const orders = getAttendedOrders();
  const totalOrders = orders.length;
  const totalQuantity = orders.reduce((sum, o) => sum + (Number(o.quantidade) || 0), 0);
  const totalIscasLigadas = orders.filter((o) => (o.contemIscaLigada || '').toUpperCase() === 'SIM').length;
  const totalCarregadores = orders.reduce((sum, o) => {
    const q = Number(o.quantidadeCarregador);
    return sum + (isNaN(q) ? (o.carregador === 'SIM' ? 1 : 0) : q);
  }, 0);

  const byLinha: Record<string, number> = {};
  for (const o of orders) {
    const l = o.linhaProducao || 'NÃO DEFINIDA';
    byLinha[l] = (byLinha[l] || 0) + (Number(o.quantidade) || 1);
  }

  return {
    totalOrders,
    totalQuantity,
    totalIscasLigadas,
    totalCarregadores,
    byLinha,
  };
}
