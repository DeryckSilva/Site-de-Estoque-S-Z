export interface SeparatedEquipment {
  id: string;
  equipmentType: string;
  serialNumber: string;
  ccid: string;
  terminalColor: string;
  terminalSize: string;
  terminalDiameter: string;
  terminalQuantity: number | string;
  batteryType: string;
  kraftBoxType: string;
  kraftQuantity: number | string;
  box3dType: string;
  box3dQuantity: number | string;
  magnetType: string;
  magnetQuantity: number | string;
  productionDeliveryDate: string;
  productionResponsible: string;
}

export interface SeparationOrderDetails {
  requestedQuantity: number;
  productType: string;
  operator: string;
  equipmentModel: string;
  modelVariation: string;
  colorVariation: string;
  businessType: string;
  deliveryType: string;
  requestDate: string;
  expectedDeliveryDate: string;
}

export interface ProductionSeparationRecord {
  id: string;
  orderNumber: string;
  clientName: string;
  orderDetails?: SeparationOrderDetails;
  separatedBy: string;
  deliveryResponsible: string;
  separationDate: string;
  equipment: SeparatedEquipment[];
}

export interface SharedProductionSeparation extends ProductionSeparationRecord {
  revision: number;
  updatedAt: string;
}

export interface CompletedProductionSeparation {
  id: string;
  orderNumber: string;
  clientName: string;
  finalizedAt: string;
  data: ProductionSeparationRecord;
}

export type EquipmentSwapComponent = 'serial' | 'ccid';

export interface ProductionEquipmentSwap {
  id: string;
  orderNumber: string;
  clientName: string;
  equipmentType: string;
  component: EquipmentSwapComponent;
  previousValue: string;
  newValue: string;
  responsible: string;
  swappedOn: string;
}

export type NewProductionEquipmentSwap = Omit<ProductionEquipmentSwap, 'id'>;
