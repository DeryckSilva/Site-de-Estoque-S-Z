import { BaseOrder } from '../types/orders';
import { autoDetectEquipmentItem } from '../data/ordersDatabase';

export const ORDERS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/11W5CmQPLs3N-qgjs8Vuar3Q2cygWEjGWL9-v9HIjJ4s/gviz/tq?tqx=out:csv&gid=0';
export const ATTENDED_ORDERS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1yXErAEikeD4yKpIPPJR4QElg9fZ7zuvePmcaT6Ks7zQ/gviz/tq?tqx=out:csv&gid=0';
export const ORDERS_START_DATE = new Date(2026, 8, 9);

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { values.push(current.trim()); current = ''; continue; }
    current += character;
  }
  values.push(current.trim());
  return values;
}

function splitCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"' && csv[index + 1] === '"' && quoted) {
      current += '"';
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === ',' && !quoted) {
      record.push(current.trim());
      current = '';
      continue;
    }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      record.push(current.trim());
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
      current = '';
      continue;
    }
    current += character;
  }

  if (current || record.length) {
    record.push(current.trim());
    if (record.some((value) => value !== '')) records.push(record);
  }
  return records;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findValue(row: Record<string, string>, names: string[], fallback = ''): string {
  const key = names.map(normalize).find((name) => row[name] !== undefined);
  return key ? row[key] : fallback;
}

function parseDate(value: string): Date | null {
  const text = value.trim();
  const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : new Date(iso.getFullYear(), iso.getMonth(), iso.getDate());
}

function isAfterStartDate(value: string): boolean {
  const parsed = parseDate(value);
  return Boolean(parsed && parsed >= ORDERS_START_DATE);
}

export function parseOrdersSheetCsv(csv: string): BaseOrder[] {
  const records = splitCsvRecords(csv);
  if (records.length < 2) return [];
  const headers = records[0].map(normalize);
  return records.slice(1).map((cells, index) => {
    const row: Record<string, string> = {};
    headers.forEach((header, headerIndex) => { row[header] = cells[headerIndex] || ''; });
    const date = findValue(row, ['data solicitacao', 'data de solicitacao', 'data do pedido', 'data pedido', 'adicionado em', 'data', 'criado em']);
    const numPedido = findValue(row, ['n pedido', 'ndo pedido', 'numero pedido', 'numero do pedido', 'pedido', 'pv', 'ordem']);
    const cliente = findValue(row, ['cliente', 'nome do cliente', 'razao social', 'solicitante'], 'Pedido da planilha');
    const quantityFields = ['quantidade', 'qtd', 'quantidade total', 'quantidade de iscas', 'quantidade de iscas 2', 'quantidade de rastreadores'];
    const quantidade = quantityFields.reduce((total, field) => total + (Number(findValue(row, [field]).replace(',', '.')) || 0), 0);
    const generation = findValue(row, ['geracao', 'modelo', 'modelo equipamento', 'equipamento', 'qual item deseja incluir no pedido', 'descricao da isca']);
    const variation = findValue(row, ['modelo variacao', 'variacao', 'tipo']);
    const detected = autoDetectEquipmentItem({ geracao: generation, modeloVariacao: variation, tipoItem: findValue(row, ['tipo item', 'categoria']) });
    return {
      id: `sheet-${index}-${numPedido || 'pedido'}`,
      numPedido: numPedido || `PLANILHA-${index + 1}`,
      dataSolicitacao: date,
      dataEnvio: date,
      cliente,
      comercial: findValue(row, ['comercial', 'vendedor']),
      tipoNegocio: findValue(row, ['tipo negocio', 'tipo de negocio', 'origem'], 'VENDA'),
      tipoItem: findValue(row, ['tipo item', 'categoria'], 'Isca de carga') as BaseOrder['tipoItem'],
      geracao: generation,
      modeloVariacao: variation,
      corVariacao: findValue(row, ['cor', 'cor variacao']),
      quantidade,
      mappedItemId: detected.id,
      mappedItemName: detected.name,
      observacao: findValue(row, ['observacao', 'observacoes', 'obs']),
      status: 'Aberto',
    } satisfies BaseOrder;
  }).filter((order) => isAfterStartDate(order.dataSolicitacao) && order.quantidade > 0 && Boolean(order.numPedido));
}

export async function loadOrdersFromGoogleSheet(): Promise<BaseOrder[]> {
  const response = await fetch(ORDERS_SHEET_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Planilha indisponível (${response.status})`);
  return parseOrdersSheetCsv(await response.text());
}

export async function loadAttendedOrderNumbers(): Promise<Set<string>> {
  const response = await fetch(ATTENDED_ORDERS_SHEET_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Planilha de pedidos atendidos indisponível (${response.status})`);
  const records = splitCsvRecords(await response.text());
  if (records.length < 2) return new Set();
  const headers = records[0].map(normalize);
  const orderIndex = headers.findIndex((header) => ['npedido', 'ndopedido', 'numeropedido', 'numerodopedido', 'pedido', 'pv', 'ordem'].includes(header));
  if (orderIndex < 0) return new Set();
  return new Set(records.slice(1).map((record) => record[orderIndex]?.trim().toLowerCase()).filter(Boolean));
}
