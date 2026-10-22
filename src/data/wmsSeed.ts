export interface WmsSeedEntry {
  location: string;
  sku: string;
  itemName: string;
  boxCount: number;
  quantity: number | null;
  rawQuantity: string;
  unit: 'UN' | 'MT';
  lot: string;
  status: string;
}

export const WMS_INITIAL_STOCK: WmsSeedEntry[] = [
  { location: 'A001000100', sku: '1805', itemName: 'IMÃ 18x5 N35', boxCount: 1, quantity: 1120, rawQuantity: '1120', unit: 'UN', lot: 'REC463081805', status: 'ARMAZENADO' },
  { location: 'A001000100', sku: '1805', itemName: 'IMÃ 18x5 N35', boxCount: 1, quantity: 84, rawQuantity: '84', unit: 'UN', lot: 'REC463081805', status: 'ARMAZENADO' },
  { location: 'A001000100', sku: '8380', itemName: 'ST-8380', boxCount: 1, quantity: 51, rawQuantity: '51', unit: 'UN', lot: 'REC463158380', status: 'ARMAZENADO' },
  { location: 'A001000100', sku: '1805', itemName: 'IMÃ 18x5 N35', boxCount: 1, quantity: 1481, rawQuantity: '1481', unit: 'UN', lot: 'REC463151805', status: 'ARMAZENADO' },
  { location: 'A001000100', sku: '1505', itemName: 'IMÃ 15x5 N35', boxCount: 1, quantity: 18, rawQuantity: '18', unit: 'UN', lot: 'REC463151505', status: 'ARMAZENADO' },
  { location: 'A001000100', sku: '1804', itemName: 'IMÃ 18x4 N35', boxCount: 1, quantity: 21, rawQuantity: '21', unit: 'UN', lot: 'REC463151804', status: 'ARMAZENADO' },
  { location: 'A001000100', sku: '2007', itemName: 'IMÃ 20x7 N35', boxCount: 1, quantity: 147, rawQuantity: '147', unit: 'UN', lot: 'REC463152007', status: 'ARMAZENADO' },
  { location: 'A001000100', sku: '3005', itemName: 'IMÃ 30x5 N35', boxCount: 1, quantity: 12, rawQuantity: '12', unit: 'UN', lot: 'REC463153005', status: 'ARMAZENADO' },
  { location: 'A001000100', sku: '2006', itemName: 'IMÃ 40x5 N35', boxCount: 1, quantity: 73, rawQuantity: '73', unit: 'UN', lot: 'REC463154005', status: 'ARMAZENADO' },
  { location: 'A004000110', sku: '5100', itemName: 'FONTE CARREGADOR', boxCount: 1, quantity: 95, rawQuantity: '95', unit: 'UN', lot: 'REC463085100', status: 'ARMAZENADO' },
  { location: 'A004000110', sku: '5100', itemName: 'FONTE CARREGADOR', boxCount: 1, quantity: 62, rawQuantity: '62', unit: 'UN', lot: 'REC463085100', status: 'ARMAZENADO' },
  { location: 'A004000110', sku: '5100', itemName: 'FONTE CARREGADOR', boxCount: 1, quantity: 35, rawQuantity: '35', unit: 'UN', lot: 'REC463085100', status: 'ARMAZENADO' },
  { location: 'A006000120', sku: '1484', itemName: 'ST-8410 4G', boxCount: 4, quantity: 200, rawQuantity: '200', unit: 'UN', lot: 'REC463081484', status: 'ARMAZENADO' },
  { location: 'A006000120', sku: '1484', itemName: 'ST-8410 4G', boxCount: 1, quantity: 15, rawQuantity: '15', unit: 'UN', lot: 'REC463081484', status: 'ARMAZENADO' },
  { location: 'A008000120', sku: '9500', itemName: 'MALETA PERSONALIZÁVEL', boxCount: 1, quantity: 5, rawQuantity: '5', unit: 'UN', lot: 'REC463099500', status: 'ARMAZENADO' },
  { location: 'A002000110', sku: '9700', itemName: 'CAIXA 3D - 8410', boxCount: 1, quantity: 215, rawQuantity: '215', unit: 'UN', lot: 'REC463099700', status: 'ARMAZENADO' },
  { location: 'A005000110', sku: '2101', itemName: 'CHIP ESEYE', boxCount: 1, quantity: 1307, rawQuantity: '1307', unit: 'UN', lot: 'REC463112101', status: 'ARMAZENADO' },
  { location: 'A005000110', sku: '2102', itemName: 'CHIP ALLCOM', boxCount: 1, quantity: 0, rawQuantity: '0', unit: 'UN', lot: 'REC463112102', status: 'ARMAZENADO' },
  { location: 'A005000110', sku: '2103', itemName: 'CHIP VIVO', boxCount: 1, quantity: 401, rawQuantity: '401', unit: 'UN', lot: 'REC463112103', status: 'ARMAZENADO' },
  { location: 'A005000110', sku: '2104', itemName: 'CHIP CLARO', boxCount: 1, quantity: 530, rawQuantity: '530', unit: 'UN', lot: 'REC463112104', status: 'ARMAZENADO' },
  { location: 'A005000110', sku: '2105', itemName: 'CHIP TIM', boxCount: 1, quantity: 0, rawQuantity: '0', unit: 'UN', lot: 'REC463112105', status: 'ARMAZENADO' },
  { location: 'A002000100', sku: '9810', itemName: 'LUVA VERMELHA', boxCount: 1, quantity: 11, rawQuantity: '11', unit: 'UN', lot: 'REC463159810', status: 'ARMAZENADO' },
  { location: 'A002000100', sku: '9811', itemName: 'LUVA LARANJA', boxCount: 1, quantity: 12, rawQuantity: '12', unit: 'UN', lot: 'REC463159811', status: 'ARMAZENADO' },
  { location: 'A002000100', sku: '9812', itemName: 'LUVA AMARELA', boxCount: 1, quantity: 11, rawQuantity: '11', unit: 'UN', lot: 'REC463159812', status: 'ARMAZENADO' },
  { location: 'A002000120', sku: '9906', itemName: 'FILTRO DE LINHA 6 TOMADAS', boxCount: 1, quantity: 7, rawQuantity: '7', unit: 'UN', lot: 'REC463159906', status: 'ARMAZENADO' },
  { location: 'A002000120', sku: '9910', itemName: 'FILTRO DE LINHA 10 TOMADAS', boxCount: 1, quantity: 7, rawQuantity: '7', unit: 'UN', lot: 'REC463159910', status: 'ARMAZENADO' },
  { location: 'A008000110', sku: '9999', itemName: 'ISCA OUTROS FORNECEDORES', boxCount: 2, quantity: 0, rawQuantity: '0', unit: 'UN', lot: 'REC463159999', status: 'ARMAZENADO' },
  { location: 'A006000110', sku: '1419', itemName: 'ST-419G LORA', boxCount: 1, quantity: 82, rawQuantity: '82', unit: 'UN', lot: 'REC463151419', status: 'ARMAZENADO' },
  { location: 'A006000120', sku: '1484', itemName: 'ST-8410 4G', boxCount: 5, quantity: 200, rawQuantity: '200', unit: 'UN', lot: 'REC463151484', status: 'ARMAZENADO' },
  { location: 'A005000120', sku: '1484', itemName: 'ST-8410 4G', boxCount: 1, quantity: 158, rawQuantity: '158', unit: 'UN', lot: 'REC463151484', status: 'ARMAZENADO' },
  { location: 'A006000110', sku: '1461', itemName: 'ST-400', boxCount: 1, quantity: null, rawQuantity: 'N/A', unit: 'UN', lot: 'REC463151461', status: 'ARMAZENADO' },
  { location: 'A001000110', sku: '6381', itemName: 'TERMO MARROM 381', boxCount: 0, quantity: 257, rawQuantity: '257', unit: 'MT', lot: 'REC463156381', status: 'ARMAZENADO' },
  { location: 'A001000110', sku: '6382', itemName: 'TERMO BRANCO 381', boxCount: 0, quantity: 0, rawQuantity: '0', unit: 'MT', lot: 'REC463156382', status: 'ARMAZENADO' },
  { location: 'A001000110', sku: '6383', itemName: 'TERMO PRETO 381', boxCount: 0, quantity: 0, rawQuantity: '0', unit: 'MT', lot: 'REC463156383', status: 'ARMAZENADO' },
  { location: 'A001000110', sku: '6384', itemName: 'TERMO AZUL 381', boxCount: 0, quantity: 100, rawQuantity: '100', unit: 'MT', lot: 'REC463156384', status: 'ARMAZENADO' },
  { location: 'A001000110', sku: '6385', itemName: 'TERMO VERMELHO 381', boxCount: 0, quantity: 85, rawQuantity: '85', unit: 'MT', lot: 'REC463156385', status: 'ARMAZENADO' },
  { location: 'A001000110', sku: '6646', itemName: 'TERMO PRETO 064', boxCount: 0, quantity: 150, rawQuantity: '150', unit: 'MT', lot: 'REC463156646', status: 'ARMAZENADO' },
  { location: 'A001000110', sku: '6386', itemName: 'TERMO CINZA 381', boxCount: 0, quantity: 43, rawQuantity: '43', unit: 'MT', lot: 'REC463156386', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8043', itemName: 'ST-43', boxCount: 0, quantity: 78, rawQuantity: '78', unit: 'UN', lot: 'REC463158043', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8310', itemName: 'ST-8310 UM', boxCount: 0, quantity: 22, rawQuantity: '22', unit: 'UN', lot: 'REC463158310', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8311', itemName: 'ST-310U', boxCount: 0, quantity: 41, rawQuantity: '41', unit: 'UN', lot: 'REC463158311', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8312', itemName: 'ST-310UC2', boxCount: 0, quantity: 47, rawQuantity: '47', unit: 'UN', lot: 'REC463158312', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8320', itemName: 'LT-32', boxCount: 0, quantity: 17, rawQuantity: '17', unit: 'UN', lot: 'REC463158320', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8321', itemName: 'LT-32 PRO', boxCount: 0, quantity: 50, rawQuantity: '50', unit: 'UN', lot: 'REC463158321', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8340', itemName: 'ST-340 UR', boxCount: 0, quantity: 20, rawQuantity: '20', unit: 'UN', lot: 'REC463158340', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8388', itemName: 'SG-BRAS', boxCount: 0, quantity: 16, rawQuantity: '16', unit: 'UN', lot: 'REC463158388', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '8395', itemName: 'ST-8395', boxCount: 0, quantity: 9, rawQuantity: '9', unit: 'UN', lot: 'REC463158395', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '7112', itemName: 'RELÉ 12V', boxCount: 0, quantity: 20, rawQuantity: '20', unit: 'UN', lot: 'REC463157112', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '7124', itemName: 'RELÉ 24V', boxCount: 0, quantity: 76, rawQuantity: '76', unit: 'UN', lot: 'REC463157124', status: 'ARMAZENADO' },
  { location: 'Armario Rastreadores', sku: '7201', itemName: 'CHICOTE', boxCount: 0, quantity: 74, rawQuantity: '74', unit: 'UN', lot: 'REC463157201', status: 'ARMAZENADO' },
];