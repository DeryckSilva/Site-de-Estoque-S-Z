import { AttendedOrder } from '../types/attendedOrders';

// Parse CSV text into AttendedOrder array
export function parseCSV(csvText: string): AttendedOrder[] {
  const lines = csvText.split('\n');
  const results: AttendedOrder[] = [];
  
  // Skip header if present
  let startIndex = 0;
  if (lines[0] && lines[0].includes('Adicionado')) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parser handling quotes
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        if (inQuotes && line[c + 1] === '"') {
          current += '"';
          c++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    if (cols.length < 5) continue;

    const adicionadoEm = cols[0] || '';
    const enderecoIp = cols[1] || '';
    const linhaProducao = cols[2] || '';
    const cliente = cols[3] || '';
    const comercial = cols[4] || '';
    const contrato = cols[5] || 'Descartável';
    const operadora = cols[6] || 'ESEYE';
    const geracao = cols[7] || '';
    const modelo = cols[8] || '';
    const quantidade = parseInt(cols[9], 10) || 1;
    const listaIdsOuPdf = cols[10] || '';
    const medidaCaixa = cols[11] || '';
    const observacao = cols[12] || '';
    const contemIscaLigada = (cols[13] || 'NÃO').toUpperCase().includes('SIM') ? 'SIM' : 'NÃO';
    const idIscaLigada = cols[14] || '';
    const numPedido = cols[15] || '';
    const carregador = cols[16] || 'NÃO';
    const quantidadeCarregador = cols[17] || '';

    const id = `att-${numPedido || Math.random().toString(36).substring(2, 9)}-${i}`;

    results.push({
      id,
      adicionadoEm,
      enderecoIp,
      linhaProducao,
      cliente,
      comercial,
      contrato,
      operadora,
      geracao,
      modelo,
      quantidade,
      listaIdsOuPdf,
      medidaCaixa,
      observacao,
      contemIscaLigada: contemIscaLigada as 'SIM' | 'NÃO',
      idIscaLigada,
      numPedido,
      carregador,
      quantidadeCarregador,
      dataFinalizacao: adicionadoEm,
    });
  }

  return results;
}
