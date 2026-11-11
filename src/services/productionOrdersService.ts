import { INITIAL_PRODUCTION_ORDERS } from '../data/productionOrdersData';
import type { ProductionOrder } from '../types/production';

const PENDING_ORDERS_KEY = 'kiraso_pending_ops';

export function readPanelProductionOrders(): ProductionOrder[] {
  const saved = localStorage.getItem(PENDING_ORDERS_KEY);
  if (!saved) return INITIAL_PRODUCTION_ORDERS;

  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      throw new Error('A lista de pedidos do Painel possui um formato inválido.');
    }
    return parsed as ProductionOrder[];
  } catch (error) {
    console.error('Falha ao carregar pedidos do painel:', error);
    return INITIAL_PRODUCTION_ORDERS;
  }
}
