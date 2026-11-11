export interface CapturedSignature {
  name: string;
  image: string;
  signedAt: string;
}

export interface PickupSignatureRequest {
  id: string;
  orderCode: string;
  salesOrder: string;
  campaignCode: string;
  customer: string;
  equipmentQuantity: number;
  chipQuantity: number;
  batteryType: string;
  separationDate: string;
  pickupDate: string;
  observations: string;
  createdAt: string;
  productionSignature?: CapturedSignature;
}
