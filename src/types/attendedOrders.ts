export interface AttendedOrder {
  id: string;
  adicionadoEm: string;
  enderecoIp?: string;
  linhaProducao: string;
  cliente: string;
  comercial: string;
  contrato: string;
  operadora: string;
  geracao: string;
  modelo: string;
  quantidade: number;
  listaIdsOuPdf?: string;
  medidaCaixa: string;
  observacao?: string;
  contemIscaLigada: 'SIM' | 'NÃO' | string;
  idIscaLigada?: string;
  numPedido: string;
  carregador?: 'SIM' | 'NÃO' | string;
  quantidadeCarregador?: number | string;
  origemOp?: string;
  finalizadoPor?: string;
}
