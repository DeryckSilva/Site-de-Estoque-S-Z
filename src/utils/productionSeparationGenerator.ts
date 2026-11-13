export interface ProductionSeparationRow {
  id: string;
  orderNumber: string;
  equipmentType: string;
  serialNumber: string;
  ccid: string;
  terminalColor: string;
  terminalSize: string;
  terminalDiameter: string;
  terminalQuantity: string;
  battery: string;
  kraftBoxType: string;
  kraftQuantity: string;
  box3dType: string;
  box3dQuantity: string;
  magnetType: string;
  magnetQuantity: string;
  deliveryDate: string;
  responsible: string;
}

export interface ProductionSeparationSequence {
  orderNumber: string;
  clientName: string;
  rows: ProductionSeparationRow[];
}

const MAX_SEQUENCE_ROWS = 9995;

function cell(row: string[], index: number): string {
  return String(row[index] ?? '');
}

function todayAsBrazilianDate(): string {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
}

export function generateProductionSeparationSequence(
  ledgerRows: string[][],
  orderNumberInput: string,
  responsible = '',
): ProductionSeparationSequence {
  const orderNumber = orderNumberInput.trim();
  if (!orderNumber) throw new Error('Informe o número do pedido.');

  const orderRow = ledgerRows.slice(1).find((row) => cell(row, 8).trim() === orderNumber);
  if (!orderRow) throw new Error(`Pedido não encontrado: ${orderNumber}`);

  const generation = cell(orderRow, 19);
  const model = cell(orderRow, 20);
  const requestedQuantity = Number(orderRow[28] ?? 0);
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    throw new Error(`O pedido ${orderNumber} não possui uma quantidade válida para gerar.`);
  }

  const rowCount = Math.ceil(requestedQuantity);
  if (rowCount > MAX_SEQUENCE_ROWS) {
    throw new Error(`A quantidade do pedido excede o limite de ${MAX_SEQUENCE_ROWS} linhas.`);
  }

  let terminalColor = '';
  for (let column = 21; column <= 27; column += 1) {
    const value = orderRow[column];
    if (value !== '' && value !== null && value !== undefined) {
      terminalColor = String(value);
      break;
    }
  }
  terminalColor = terminalColor
    .replace(' Padrão', '')
    .replace(' Fina', '')
    .replace(' C-imã', '')
    .trim();

  let equipmentType = generation;
  if (generation.includes('SZ ONE')) equipmentType = 'SZ ONE';
  else if (generation.includes('ST4410')) equipmentType = 'ST4410G';
  else if (generation.includes('ST410')) equipmentType = 'ST410G';
  else if (generation.includes('ST8410')) equipmentType = 'ST8410';

  let battery = '';
  if (generation.includes('1.800')) battery = '1.800';
  if (generation.includes('2.800')) battery = '2.800';

  let terminalSize = '';
  if (['SZ ONE', 'ST4410G', 'ST410G'].includes(equipmentType)) terminalSize = '381';
  if (equipmentType === 'ST8410') terminalSize = '450';

  let terminalDiameter = '';
  if (model.includes('Fina')) terminalDiameter = '0,20';
  else if (model.includes('Padrão') || model.includes('Imantada')) terminalDiameter = '0,17';

  let kraftBoxType = 'N/A';
  let kraftQuantity = 'N/A';
  let box3dType = 'N/A';
  let box3dQuantity = 'N/A';
  let magnetType = 'N/A';
  let magnetQuantity = 'N/A';

  if (model.includes('Kraft')) {
    terminalColor = 'N/A';
    terminalSize = 'N/A';
    terminalDiameter = 'N/A';
    kraftBoxType = cell(orderRow, 25).trim() || 'KRAFT';
    kraftQuantity = '1';
  }

  const box3d = cell(orderRow, 59).trim();
  if (box3d) {
    terminalColor = 'N/A';
    terminalSize = 'N/A';
    terminalDiameter = 'N/A';
    kraftBoxType = 'N/A';
    kraftQuantity = 'N/A';
    box3dType = box3d;
    box3dQuantity = '1';
    magnetType = 'N/A';
    magnetQuantity = 'N/A';

    if (box3d.toUpperCase().includes('IMANTADA')) {
      magnetType = '18x5';
      magnetQuantity = '3';
    }
  }

  if (model.includes('Imantada') && box3dType === 'N/A') {
    magnetType = '18x5';
    magnetQuantity = '2';
  }

  const terminalQuantity =
    terminalColor === 'N/A' || kraftBoxType !== 'N/A' || box3dType !== 'N/A' ? 'N/A' : '1';
  const deliveryDate = todayAsBrazilianDate();

  const rows = Array.from({ length: rowCount }, (_, index): ProductionSeparationRow => ({
    id: `${orderNumber}-${index}`,
    orderNumber,
    equipmentType,
    serialNumber: '',
    ccid: '',
    terminalColor,
    terminalSize,
    terminalDiameter,
    terminalQuantity,
    battery,
    kraftBoxType,
    kraftQuantity,
    box3dType,
    box3dQuantity,
    magnetType,
    magnetQuantity,
    deliveryDate,
    responsible,
  }));

  return {
    orderNumber,
    clientName: cell(orderRow, 9).trim(),
    rows,
  };
}
