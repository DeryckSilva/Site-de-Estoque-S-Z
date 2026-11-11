import type { PickupSignatureRequest } from './pickupSignature';

export type Unit = 'UN' | 'MT';
export type MovementKind = 'baixa' | 'transferencia' | 'saida_producao';

export type InventoryEntry = {
  id: string;
  location: string;
  itemCode: string;
  itemName: string;
  lot: string;
  boxCount: number;
  quantity: number | null;
  rawQuantity: string;
  unit: Unit;
  status: string;
  serialized: boolean;
  serials: string[];
  supplier: string;
  invoiceNumber: string;
  receivedDate: string;
  barcode: string;
};

export type StockMovement = {
  id: string;
  date: string;
  kind: MovementKind;
  itemCode: string;
  itemName: string;
  lot: string;
  locationFrom: string;
  locationTo: string;
  location?: string;
  quantity: number;
  unit: Unit;
  reference: string;
  serials: string[];
  wallBarcode: string;
  productionOrderCode: string;
};

export type WarehouseObjectKind = 'rack' | 'wall' | 'workbench' | 'door' | 'cabinet' | 'machine' | 'stairs' | 'box' | 'cart' | 'window';

export type WarehouseSceneObject = {
  id: string;
  type: WarehouseObjectKind;
  label: string;
  warehouseKey?: string;
  x: number;
  y: number;
  rotation: 0 | 90;
  width?: number;
  depth?: number;
  height?: number;
  elevation?: number;
  color?: string;
};

export type WmsData = {
  entries: InventoryEntry[];
  movements: StockMovement[];
  layout?: WarehouseSceneObject[];
  room?: { width: number; length: number };
  pickupSignatures?: PickupSignatureRequest[];
};

export const DEFAULT_WAREHOUSE_LAYOUT: WarehouseSceneObject[] = [
  { id: 'rack-A001', type: 'rack', label: 'Estante 1', warehouseKey: 'A001', x: -0.95, y: 2.3, rotation: 0, width: 0.5, depth: 1, height: 2 },
  { id: 'rack-A002', type: 'rack', label: 'Estante 2', warehouseKey: 'A002', x: -0.95, y: 3.5, rotation: 0, width: 0.5, depth: 1, height: 2 },
  { id: 'rack-A003', type: 'rack', label: 'Estante 3', warehouseKey: 'A003', x: -0.95, y: 4.7, rotation: 0, width: 0.5, depth: 1, height: 2 },
  { id: 'rack-A004', type: 'rack', label: 'Estante 4', warehouseKey: 'A004', x: -0.95, y: 5.9, rotation: 0, width: 0.5, depth: 1, height: 2 },
  { id: 'cabinet-stock', type: 'cabinet', label: 'Armário', x: -0.95, y: 1.2, rotation: 0, width: 0.5, depth: 0.9, height: 1.6 },
  { id: 'equipment-main', type: 'machine', label: 'Máquina de selar', x: 0.9, y: 1, rotation: 0, width: 0.6, depth: 0.7, height: 0.9 },
  { id: 'bench-main', type: 'workbench', label: 'Mesa de trabalho', x: -0.85, y: -1, rotation: 0, width: 0.7, depth: 1.4, height: 0.75 },
  { id: 'door-main', type: 'door', label: 'Porta', x: -1.15, y: 0.2, rotation: 0, width: 0.1, depth: 0.9, height: 2.1 },
  { id: 'rack-A005', type: 'rack', label: 'Estante 5', warehouseKey: 'A005', x: 0.95, y: -1, rotation: 0, width: 0.5, depth: 1, height: 2 },
  { id: 'window-main', type: 'window', label: 'Janela do almoxarifado', x: -1.15, y: -0.85, rotation: 0, width: 0.1, depth: 1, height: 0.9, elevation: 1, color: '#aed6e8' },
];

export const DEFAULT_WAREHOUSE_ROOM = { width: 2.4, length: 9 };
