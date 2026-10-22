import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  X,
  Package,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Hash,
  Zap,
} from 'lucide-react';
import { ProductionOrder } from '../../types/production';
import { giveOrderBaixa, FinalizeBaixaParams } from '../../services/attendedOrdersService';

interface FinalizeBaixaModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: ProductionOrder | null;
  onSuccess?: () => void;
}

const LINHAS_PRODUCAO = ['LINHA S-01', 'LINHA S-02', 'LABORATÓRIO', 'LOGISTICA'];

const MEDIDAS_CAIXA = [
  'CAIXA 1 - 20x12x3',
  'CAIXA 2 - 20x12x13',
  'CAIXA 3 - 26x12x18',
  'CAIXA 4 - 30x21x11',
  'CAIXA 5 - 30x21x16',
  'CAIXA 6 - 43x21x27',
  'CAIXA 7 - 26x18x9',
  'CAIXA MINI - 16x12x7',
];

const OPERADORAS = ['ESEYE', 'VIVO - RT', 'VIVO', 'ALLCOM', 'CLARO', 'SEM CHIP', 'TIM'];

const CONTRATOS = ['Descartável', 'Retornável (Sem Adesão)', 'Retornável (Com Adesão)'];

const GERACOES = [
  'ST - 8410 (NOVA)',
  'ST-4410G (DEV)',
  'ST - 4410G (NOVA)',
  'ST-410G (DEV)',
  'ST - 410G (NOVA)',
  'RASTREADOR',
  'TAGS',
  'GL33 (4G)',
  'GL 33 CG (4G Devolução)',
];

const MODELOS = [
  'PADRÃO (BRANCA)',
  'IMANTADA (PRETA)',
  'FINA (MARROM)',
  'PADRÃO (MARROM)',
  'PADRÃO (PRETA)',
  'KRAFT FINA | PAD',
  'KRAFT QUADRADA | 4G',
  'APENAS TERMO (BRANCA)',
  'PADRÃO (AZUL)',
  'PADRÃO (CINZA)',
  'PADRÃO (VERMELHA)',
  'IMANTADA | 3D',
  'SMART TAG (CARD)',
  'WEBTAG C/IMÃ',
  'TAG CARRETA',
  'RASTREADORES (ST-8380)',
  'RASTREADORES (ST-8310UM)',
  'RASTREADORES (ST-8395)',
  'RASTREADORES (ST-340UR)',
];

export function FinalizeBaixaModal({ isOpen, onClose, order, onSuccess }: FinalizeBaixaModalProps) {
  const [numPedido, setNumPedido] = useState('');
  const [cliente, setCliente] = useState('');
  const [linhaProducao, setLinhaProducao] = useState('LINHA S-01');
  const [comercial, setComercial] = useState('TIAGO');
  const [contrato, setContrato] = useState('Descartável');
  const [operadora, setOperadora] = useState('ESEYE');
  const [geracao, setGeracao] = useState('ST - 8410 (NOVA)');
  const [modelo, setModelo] = useState('PADRÃO (BRANCA)');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [medidaCaixa, setMedidaCaixa] = useState('CAIXA 1 - 20x12x3');
  const [contemIscaLigada, setContemIscaLigada] = useState<'SIM' | 'NÃO'>('NÃO');
  const [idIscaLigada, setIdIscaLigada] = useState('');
  const [carregador, setCarregador] = useState<'SIM' | 'NÃO'>('NÃO');
  const [quantidadeCarregador, setQuantidadeCarregador] = useState<string>('');
  const [observacao, setObservacao] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  // Auto-fill from selected order
  useEffect(() => {
    if (order) {
      setNumPedido(order.pedido || '');
      setCliente(order.clienteSolicitante || '');
      setQuantidade(order.falta > 0 ? order.falta : order.totalQtd);
      setObservacao(order.observacoes || '');

      // Infer generation & model
      const modelStr = order.itemModel || '';
      if (modelStr.includes('8410')) {
        setGeracao('ST - 8410 (NOVA)');
      } else if (modelStr.includes('4410')) {
        setGeracao(modelStr.includes('DEV') ? 'ST-4410G (DEV)' : 'ST - 4410G (NOVA)');
      } else if (modelStr.includes('410')) {
        setGeracao(modelStr.includes('DEV') ? 'ST-410G (DEV)' : 'ST - 410G (NOVA)');
      } else if (modelStr.toLowerCase().includes('tag')) {
        setGeracao('TAGS');
        setModelo('SMART TAG (CARD)');
      } else if (modelStr.toLowerCase().includes('rastreador')) {
        setGeracao('RASTREADOR');
        setModelo('RASTREADORES (ST-8380)');
      }

      if (modelStr.toLowerCase().includes('imantada') || modelStr.toLowerCase().includes('ímã')) {
        setModelo('IMANTADA (PRETA)');
      } else if (modelStr.toLowerCase().includes('fina')) {
        setModelo('FINA (MARROM)');
      } else if (modelStr.toLowerCase().includes('kraft')) {
        setModelo('KRAFT QUADRADA | 4G');
      }

      // Auto pick suitable box
      const qty = order.falta || order.totalQtd;
      if (qty <= 2) setMedidaCaixa('CAIXA 1 - 20x12x3');
      else if (qty <= 10) setMedidaCaixa('CAIXA MINI - 16x12x7');
      else if (qty <= 25) setMedidaCaixa('CAIXA 2 - 20x12x13');
      else if (qty <= 50) setMedidaCaixa('CAIXA 3 - 26x12x18');
      else if (qty <= 100) setMedidaCaixa('CAIXA 5 - 30x21x16');
      else setMedidaCaixa('CAIXA 6 - 43x21x27');
    }
  }, [order, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numPedido.trim()) {
      setErrorMsg('Informe o número do pedido.');
      return;
    }
    if (!cliente.trim()) {
      setErrorMsg('Informe o cliente.');
      return;
    }
    if (quantidade <= 0) {
      setErrorMsg('A quantidade deve ser maior que zero.');
      return;
    }
    if (order) {
      const remainingQuantity = Math.max(0, Number(order.falta) || Number(order.totalQtd) || 0);
      const availableDestined = Math.max(0, (Number(order.destinado) || 0) - (Number(order.produzido) || 0));
      if (availableDestined < remainingQuantity) {
        setErrorMsg(`A Logística destinou ${availableDestined} de ${remainingQuantity} equipamento(s). Aguarde a destinação total.`);
        return;
      }
      if (Number(quantidade) !== remainingQuantity) {
        setErrorMsg(`A baixa deve registrar as ${remainingQuantity} unidades restantes do pedido.`);
        return;
      }
    }

    const payload: FinalizeBaixaParams = {
      numPedido: numPedido.trim(),
      cliente: cliente.trim(),
      linhaProducao,
      comercial,
      contrato,
      operadora,
      geracao,
      modelo,
      quantidade: Number(quantidade),
      medidaCaixa,
      contemIscaLigada,
      idIscaLigada: idIscaLigada.trim(),
      carregador,
      quantidadeCarregador: carregador === 'SIM' ? quantidadeCarregador || '1' : '',
      observacao: observacao.trim(),
      origemOp: order?.ordem,
    };

    giveOrderBaixa(payload);
    setSuccessNotice(true);

    setTimeout(() => {
      setSuccessNotice(false);
      if (onSuccess) onSuccess();
      onClose();
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-r from-emerald-800 to-slate-900 rounded-t-2xl text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-xs border border-white/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Dar Baixa no Pedido (Finalização)</h2>
              <p className="text-xs text-emerald-200">
                Os dados serão registrados em Pedidos atendidos e debitarão a fila de pedidos pendentes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success overlay banner */}
        {successNotice && (
          <div className="p-4 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Baixa concluída com sucesso! Atualizando ambas as planilhas em conjunto...</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 p-2.5 text-red-700 text-xs flex items-center gap-2 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sync indicator bar */}
          <div className="flex items-center justify-between rounded-lg bg-blue-50/80 px-3.5 py-2 border border-blue-200/60 text-blue-900">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-700" />
              <span className="font-semibold">Sincronização em Conjunto Ativa</span>
            </div>
            <span className="text-[11px] text-blue-700 bg-white/80 px-2 py-0.5 rounded border border-blue-200 font-mono">
              Entra na Baixa ⇄ Sai de "A atender"
            </span>
          </div>

          {/* Order and Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">N° do Pedido *</label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  value={numPedido}
                  onChange={(e) => setNumPedido(e.target.value)}
                  placeholder="Ex: 3832-18092026-07"
                  className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2.5 text-xs text-slate-800 font-mono font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Cliente *</label>
              <input
                type="text"
                required
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome da empresa ou solicitante"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>

          {/* Linha de Produção, Comercial, Contrato */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Linha de Produção</label>
              <select
                value={linhaProducao}
                onChange={(e) => setLinhaProducao(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white font-medium focus:border-emerald-600 outline-none"
              >
                {LINHAS_PRODUCAO.map((lp) => (
                  <option key={lp} value={lp}>
                    {lp}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Comercial</label>
              <input
                type="text"
                value={comercial}
                onChange={(e) => setComercial(e.target.value)}
                placeholder="Ex: Tiago, Marcelo"
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Contrato</label>
              <select
                value={contrato}
                onChange={(e) => setContrato(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:border-emerald-600 outline-none"
              >
                {CONTRATOS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Operadora, Geração, Modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Operadora</label>
              <select
                value={operadora}
                onChange={(e) => setOperadora(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:border-emerald-600 outline-none"
              >
                {OPERADORAS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Geração</label>
              <select
                value={geracao}
                onChange={(e) => setGeracao(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white font-medium focus:border-emerald-600 outline-none"
              >
                {GERACOES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Modelo / Variação</label>
              <select
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:border-emerald-600 outline-none"
              >
                {MODELOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantidade & Medida da Caixa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Quantidade Atendida / Baixada (UN) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-slate-900 bg-white focus:border-emerald-600 outline-none"
              />
              {order && order.falta > 0 && (
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Total da OP: {order.totalQtd} UN · Falta original: {order.falta} UN
                </span>
              )}
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">Medida da Caixa</label>
              <select
                value={medidaCaixa}
                onChange={(e) => setMedidaCaixa(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-slate-800 bg-white font-medium focus:border-emerald-600 outline-none"
              >
                {MEDIDAS_CAIXA.map((caixa) => (
                  <option key={caixa} value={caixa}>
                    {caixa}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contém Isca Ligada & IDs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Contém Isca Ligada?</label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setContemIscaLigada('SIM')}
                  className={`flex-1 py-1.5 rounded-lg border font-bold text-xs transition-colors ${
                    contemIscaLigada === 'SIM'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => setContemIscaLigada('NÃO')}
                  className={`flex-1 py-1.5 rounded-lg border font-bold text-xs transition-colors ${
                    contemIscaLigada === 'NÃO'
                      ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">
                ID da Isca Ligada / Seriais
              </label>
              <input
                type="text"
                value={idIscaLigada}
                onChange={(e) => setIdIscaLigada(e.target.value)}
                placeholder="Ex: 2440006853 ou TODAS"
                disabled={contemIscaLigada === 'NÃO'}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-slate-800 disabled:bg-gray-100 disabled:text-gray-400 focus:border-emerald-600 outline-none font-mono"
              />
            </div>
          </div>

          {/* Carregador */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Enviou Carregador?</label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setCarregador('SIM')}
                  className={`flex-1 py-1.5 rounded-lg border font-bold text-xs transition-colors ${
                    carregador === 'SIM'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => setCarregador('NÃO')}
                  className={`flex-1 py-1.5 rounded-lg border font-bold text-xs transition-colors ${
                    carregador === 'NÃO'
                      ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Quantidade Carregador</label>
              <input
                type="number"
                min="1"
                value={quantidadeCarregador}
                onChange={(e) => setQuantidadeCarregador(e.target.value)}
                placeholder="Ex: 2"
                disabled={carregador === 'NÃO'}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-slate-800 disabled:bg-gray-100 disabled:text-gray-400 focus:border-emerald-600 outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Observações</label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Lote, frete, motoboy, etc."
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              Registrado por: <strong>Deryck Silva (Produção)</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirmar e Dar Baixa na Planilha</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
