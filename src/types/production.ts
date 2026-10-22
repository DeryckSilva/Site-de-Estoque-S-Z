export type ProductionPriority = 'Crítica' | 'Alta' | 'Padrão';

export type ProductionStatus = 
  | 'A atender'
  | 'Fila de Bancada'
  | 'Gravação / Firmware'
  | 'Montagem e Bateria'
  | 'Testes de Comunicação'
  | 'Concluído';

export interface ProductionOrder {
  id: string;
  prioridade: ProductionPriority;
  ordem: string; // e.g. OP-2026-0042
  origem: string; // e.g. Pedido de Venda
  tipoOrigemBadge?: string; // e.g. Fatura
  clienteSolicitante: string; // e.g. marcos.santos@sezseg.com.br
  pedido: string; // e.g. PV-2026-0011
  itemModel: string; // e.g. ST - 4410G (4G)
  produzido: number;
  falta: number;
  totalQtd: number;
  destinado: number; // equipamentos vinculados ao pedido
  dataCriacao: string;
  status: ProductionStatus;
  tecnicoResponsavel?: string;
  bancada?: string;
  observacoes?: string;
}

export interface SerialUnit {
  id: string;
  serialNumber: string;
  imei?: string;
  ordemId: string;
  ordemCodigo: string;
  itemModel: string;
  status: 'Gravado' | 'Testado' | 'Aprovado' | 'Expedido';
  dataHora: string;
  tecnico: string;
}
