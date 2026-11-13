import type {
  CompletedProductionSeparation,
  ProductionEquipmentSwap,
} from '../types/productionSeparation';

const HEADER_FILL = 'FF12365C';

function styleWorksheet(worksheet: import('exceljs').Worksheet): void {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: worksheet.rowCount, column: worksheet.columnCount },
  };
  const header = worksheet.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
}

async function downloadWorkbook(workbook: import('exceljs').Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadSeparationHistoryExcel(
  records: CompletedProductionSeparation[],
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Produção & Logística S&Z';
  const worksheet = workbook.addWorksheet('Separações concluídas');
  worksheet.columns = [
    { header: 'Nº do pedido', key: 'orderNumber', width: 20 },
    { header: 'Cliente', key: 'clientName', width: 32 },
    { header: 'Concluída em', key: 'finalizedAt', width: 20 },
    { header: 'Unidade', key: 'unit', width: 10 },
    { header: 'Tipo de equipamento', key: 'equipmentType', width: 22 },
    { header: 'Serial', key: 'serialNumber', width: 24 },
    { header: 'CCID / chip', key: 'ccid', width: 24 },
    { header: 'Cor termo', key: 'terminalColor', width: 18 },
    { header: 'Tam. termo', key: 'terminalSize', width: 14 },
    { header: 'Diâmetro', key: 'terminalDiameter', width: 14 },
    { header: 'Qtd. termo', key: 'terminalQuantity', width: 14 },
    { header: 'Bateria', key: 'batteryType', width: 14 },
    { header: 'Tipo cx. Kraft', key: 'kraftBoxType', width: 20 },
    { header: 'Qtd. Kraft', key: 'kraftQuantity', width: 14 },
    { header: 'Tipo cx. 3D', key: 'box3dType', width: 20 },
    { header: 'Qtd. 3D', key: 'box3dQuantity', width: 14 },
    { header: 'Tipo ímã', key: 'magnetType', width: 16 },
    { header: 'Qtd. ímã', key: 'magnetQuantity', width: 14 },
    { header: 'Data', key: 'deliveryDate', width: 16 },
    { header: 'Responsável', key: 'responsible', width: 24 },
  ];

  for (const record of records) {
    record.data.equipment.forEach((unit, index) => {
      worksheet.addRow({
        orderNumber: record.orderNumber,
        clientName: record.clientName,
        finalizedAt: new Date(record.finalizedAt),
        unit: index + 1,
        equipmentType: unit.equipmentType,
        serialNumber: unit.serialNumber,
        ccid: unit.ccid,
        terminalColor: unit.terminalColor,
        terminalSize: unit.terminalSize,
        terminalDiameter: unit.terminalDiameter,
        terminalQuantity: unit.terminalQuantity,
        batteryType: unit.batteryType,
        kraftBoxType: unit.kraftBoxType,
        kraftQuantity: unit.kraftQuantity,
        box3dType: unit.box3dType,
        box3dQuantity: unit.box3dQuantity,
        magnetType: unit.magnetType,
        magnetQuantity: unit.magnetQuantity,
        deliveryDate: unit.productionDeliveryDate,
        responsible: unit.productionResponsible,
      });
    });
  }

  styleWorksheet(worksheet);
  worksheet.getColumn('finalizedAt').numFmt = 'dd/mm/yyyy hh:mm';
  await downloadWorkbook(workbook, `historico_separacoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadEquipmentSwapHistoryExcel(
  swaps: ProductionEquipmentSwap[],
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Produção & Logística S&Z';
  const worksheet = workbook.addWorksheet('Histórico de trocas');
  worksheet.columns = [
    { header: 'Nº do pedido', key: 'orderNumber', width: 20 },
    { header: 'Cliente', key: 'clientName', width: 32 },
    { header: 'Equipamento', key: 'equipmentType', width: 22 },
    { header: 'Item trocado', key: 'component', width: 16 },
    { header: 'Valor antigo', key: 'previousValue', width: 28 },
    { header: 'Valor novo', key: 'newValue', width: 28 },
    { header: 'Responsável', key: 'responsible', width: 24 },
    { header: 'Data da troca', key: 'swappedOn', width: 16 },
  ];

  swaps.forEach((swap) => {
    worksheet.addRow({
      orderNumber: swap.orderNumber,
      clientName: swap.clientName,
      equipmentType: swap.equipmentType,
      component: swap.component === 'serial' ? 'Serial' : 'Chip / CCID',
      previousValue: swap.previousValue,
      newValue: swap.newValue,
      responsible: swap.responsible,
      swappedOn: swap.swappedOn,
    });
  });

  styleWorksheet(worksheet);
  await downloadWorkbook(workbook, `historico_trocas_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
