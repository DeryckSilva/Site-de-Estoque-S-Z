import type {
  CalculatedItemRow,
  ChipReportRow,
  MappingCustomColumn,
  MappingLayoutColumn,
} from '../types/mapping';

interface MappingExcelExportData {
  rows: CalculatedItemRow[];
  layoutColumns: MappingLayoutColumn[];
  customColumns: MappingCustomColumn[];
  customColumnValues: Record<string, Record<string, number>>;
  chipReportRows: ChipReportRow[];
}

const colors = {
  navy: 'FF0E2A47',
  blue: 'FF12365C',
  group: 'FF062C63',
  paleBlue: 'FFE5EFFC',
  border: 'FFB8C6D8',
  white: 'FFFFFFFF',
  redFill: 'FFFFE2E2',
  redText: 'FFB91C1C',
  amber: 'FFFFF4D6',
};

function applyRowStyle(
  row: ReturnType<import('exceljs').Worksheet['addRow']>,
  fill: string,
  bold = false
): void {
  row.height = 20;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = { name: 'Calibri', size: 10, bold, color: { argb: colors.navy } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: colors.border } },
      right: { style: 'thin', color: { argb: colors.border } },
    };
  });
}

export async function downloadMappingExcel({
  rows,
  layoutColumns,
  customColumns,
  customColumnValues,
  chipReportRows,
}: MappingExcelExportData): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Produção & Logística S&Z';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet('Mapeamento');
  const rowById = new Map(rows.map((row) => [row.item.id, row]));
  const columnCount = 8 + customColumns.length;
  worksheet.columns = [
    { width: 34 },
    ...Array.from({ length: columnCount - 1 }, () => ({ width: 16 })),
  ];
  worksheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };

  worksheet.mergeCells(1, 1, 1, columnCount);
  const title = worksheet.getCell(1, 1);
  title.value = 'MAPEAMENTO DE PRODUÇÃO & ESTOQUE';
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: colors.white } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells(2, 1, 3, 1);
  worksheet.getCell(2, 1).value = 'MODELO / EQUIPAMENTO';
  worksheet.getCell(2, 2).value = 'SALDO';
  worksheet.getCell(3, 2).value = 'Físico';
  worksheet.mergeCells(2, 3, 2, 4);
  worksheet.getCell(2, 3).value = 'COMPROMETIDAS';
  worksheet.getCell(3, 3).value = 'Com pedido';
  worksheet.getCell(3, 4).value = 'Sem pedido';
  worksheet.getCell(2, 5).value = 'SALDO DISPONÍVEL';
  worksheet.getCell(3, 5).value = 'Saldo Real';
  worksheet.mergeCells(2, 6, 2, 7);
  worksheet.getCell(2, 6).value = 'EXTERNO / ENTREGA PREVISTA';
  worksheet.getCell(3, 6).value = 'Manutenção';
  worksheet.getCell(3, 7).value = 'Compra realizada';
  worksheet.mergeCells(2, 8, 3, 8);
  worksheet.getCell(2, 8).value = 'SALDO PÓS ENTREGA';
  customColumns.forEach((column, index) => {
    const columnNumber = 9 + index;
    worksheet.mergeCells(2, columnNumber, 3, columnNumber);
    worksheet.getCell(2, columnNumber).value = column.title;
  });
  for (let rowNumber = 2; rowNumber <= 3; rowNumber += 1) {
    const headerRow = worksheet.getRow(rowNumber);
    headerRow.height = 28;
    for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
      const cell = worksheet.getCell(rowNumber, columnNumber);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.blue } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: colors.border } },
        right: { style: 'thin', color: { argb: colors.border } },
      };
    }
  }
  [2, 6, 7].forEach((columnNumber) => {
    worksheet.getCell(3, columnNumber).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colors.amber },
    };
    worksheet.getCell(3, columnNumber).font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: colors.navy },
    };
  });

  for (const layoutColumn of layoutColumns) {
    const columnRows = layoutColumn.itemIds
      .map((itemId) => rowById.get(itemId))
      .filter((row): row is CalculatedItemRow => Boolean(row));
    const groupRow = worksheet.addRow([layoutColumn.title]);
    worksheet.mergeCells(groupRow.number, 1, groupRow.number, columnCount);
    groupRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.white } };
    groupRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.group } };
    groupRow.getCell(1).alignment = { vertical: 'middle' };
    groupRow.height = 22;

    const totals = Array.from({ length: columnCount - 1 }, () => 0);
    for (const row of columnRows) {
      const customValues = customColumns.map((column) => customColumnValues[column.id]?.[row.item.id] || 0);
      const values = [
        row.fisico,
        row.comPedido,
        row.semPedido,
        row.saldoReal,
        row.emManutencao,
        row.compraRealizada,
        row.saldoPosEntrega,
        ...customValues,
      ];
      values.forEach((value, index) => {
        totals[index] += value;
      });
      const excelRow = worksheet.addRow([row.item.name, ...values]);
      applyRowStyle(excelRow, colors.white);
      excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      [5, 8].forEach((columnNumber) => {
        if (Number(excelRow.getCell(columnNumber).value) < 0) {
          excelRow.getCell(columnNumber).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colors.redFill },
          };
          excelRow.getCell(columnNumber).font = {
            name: 'Calibri',
            size: 10,
            bold: true,
            color: { argb: colors.redText },
          };
        }
      });
    }

    if (columnRows.length > 0) {
      const totalRow = worksheet.addRow([`TOTAL ${layoutColumn.title}`, ...totals]);
      applyRowStyle(totalRow, colors.paleBlue, true);
      totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    }
  }

  const chipTitleRowNumber = worksheet.lastRow!.number + 2;
  worksheet.mergeCells(chipTitleRowNumber, 1, chipTitleRowNumber, 6);
  const chipTitle = worksheet.getCell(chipTitleRowNumber, 1);
  chipTitle.value = 'MINI RELATÓRIO DE CHIPS';
  chipTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
  chipTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: colors.white } };
  chipTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(chipTitleRowNumber).height = 26;

  const chipHeaderRow = worksheet.addRow([
    'Operadora',
    'Saldo Físico',
    'Comprometidas com Pedido',
    'Comprometidas sem Pedido',
    'Entregues na Produção',
    'Saldo Disponível Real',
  ]);
  applyRowStyle(chipHeaderRow, colors.blue, true);
  chipHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  chipHeaderRow.height = 34;

  const chipTotals = { saldoFisico: 0, comPedido: 0, semPedido: 0, entregueProducao: 0 };
  chipReportRows.forEach((chipRow) => {
    chipTotals.saldoFisico += chipRow.saldoFisico;
    chipTotals.comPedido += chipRow.comPedido;
    chipTotals.semPedido += chipRow.semPedido;
    chipTotals.entregueProducao += chipRow.entregueProducao;
    const excelRowNumber = worksheet.lastRow!.number + 1;
    const saldoReal = chipRow.saldoFisico - chipRow.comPedido -
      chipRow.semPedido + chipRow.entregueProducao;
    const excelRow = worksheet.addRow([
      chipRow.operadora,
      chipRow.saldoFisico,
      chipRow.comPedido,
      chipRow.semPedido,
      chipRow.entregueProducao,
      { formula: `B${excelRowNumber}-C${excelRowNumber}-D${excelRowNumber}+E${excelRowNumber}`, result: saldoReal },
    ]);
    applyRowStyle(excelRow, colors.white);
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  });
  const chipTotal = worksheet.addRow([
    'TOTAL CHIPS',
    chipTotals.saldoFisico,
    chipTotals.comPedido,
    chipTotals.semPedido,
    chipTotals.entregueProducao,
    {
      formula: `B${worksheet.lastRow!.number + 1}-C${worksheet.lastRow!.number + 1}-D${worksheet.lastRow!.number + 1}+E${worksheet.lastRow!.number + 1}`,
      result: chipTotals.saldoFisico - chipTotals.comPedido - chipTotals.semPedido + chipTotals.entregueProducao,
    },
  ]);
  applyRowStyle(chipTotal, colors.paleBlue, true);
  chipTotal.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mapeamento_producao_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
