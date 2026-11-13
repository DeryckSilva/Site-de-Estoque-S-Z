export interface SeparatedEquipment {
  id: string;
  equipmentType: string;
  serialNumber: string;
  ccid: string;
  terminalColor: string;
  terminalSize: string;
  terminalDiameter: string;
  terminalQuantity: number;
  batteryType: string;
  kraftBoxType: string;
  kraftQuantity: number;
  box3dType: string;
  box3dQuantity: number;
  magnetType: string;
  magnetQuantity: number;
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
