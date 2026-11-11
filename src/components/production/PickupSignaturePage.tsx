import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, CheckCircle2, Eraser, Handshake, PackageCheck, PenLine } from 'lucide-react';
import type { CapturedSignature, PickupSignatureRequest } from '../../types/pickupSignature';
import { loadPickupSignatures, savePickupSignature, watchPickupSignatures } from '../../services/pickupSignatureService';
import { sharedPickupClient } from '../../services/pickupSignatureStore';

function SignaturePad({ onChange }: { onChange: (image: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const getContext = () => canvasRef.current?.getContext('2d') ?? null;
  const getPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const context = getContext();
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = getPosition(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
    drawingRef.current = true;
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = getContext();
    if (!context) return;
    const position = getPosition(event);
    context.lineTo(position.x, position.y);
    context.stroke();
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = getContext();
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = bounds.width * ratio;
    canvas.height = bounds.height * ratio;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.strokeStyle = '#0f172a';
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <canvas
        ref={canvasRef}
        aria-label="Área para desenhar a assinatura"
        className="block h-36 w-full touch-none"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />
      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
        <span className="text-[11px] text-slate-500">Assine com o dedo ou mouse</span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-red-700">
          <Eraser className="h-3.5 w-3.5" /> Limpar
        </button>
      </div>
    </div>
  );
}

function formatDate(date: string): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('pt-BR');
}

function formatDateTime(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString('pt-BR');
}

export function PickupSignaturePage() {
  const requestId = useMemo(() => new URLSearchParams(window.location.search).get('id') ?? '', []);
  const isTabletFlow = useMemo(() => new URLSearchParams(window.location.search).get('source') === 'tablet', []);
  const tabletKioskUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('view', 'retirada-interativa');
    return url.toString();
  }, []);
  const [request, setRequest] = useState<PickupSignatureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refreshRequest = async () => {
    if (!requestId) {
      setLoading(false);
      setError('Este QR Code está sem identificação de retirada.');
      return;
    }
    try {
      const [found] = await loadPickupSignatures(requestId);
      setRequest(found);
      setError(found ? '' : sharedPickupClient
        ? 'Retirada não encontrada no compartilhamento. Se este QR foi criado antes da configuração, gere um novo QR Code.'
        : 'Esta campanha foi salva apenas no navegador da Produção. Configure o Supabase e gere um novo QR Code para abri-la no celular.');
    } catch (loadError) {
      console.error('Falha ao carregar o comprovante de retirada:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o comprovante.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshRequest();
    return watchPickupSignatures(() => void refreshRequest());
  }, [requestId]);

  const submitSignature = async () => {
    if (request?.productionSignature) {
      setError('Esta retirada já foi assinada pela Produção e está disponível somente para consulta.');
      return;
    }
    if (!request || !name.trim() || !image) {
      setError('Informe seu nome e desenhe sua assinatura antes de confirmar.');
      return;
    }
    const captured: CapturedSignature = {
      name: name.trim(),
      image,
      signedAt: new Date().toISOString(),
    };
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await savePickupSignature(request, captured);
      await refreshRequest();
      setImage('');
      setSuccess('Assinatura registrada. Este QR Code agora está disponível somente para consulta.');
    } catch (saveError) {
      console.error('Falha ao salvar assinatura da retirada:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a assinatura. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white">
              <PackageCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900">Santos&amp;Zanon</p>
              <p className="text-[11px] text-slate-500">Tecnologia e Rastreamento</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-sm font-extrabold uppercase tracking-wide text-slate-800 sm:text-base">Retirada de campanha</h1>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">Registro de retirada da Produção</p>
          </div>
        </header>

        {isTabletFlow && (
          <div className="px-5 pt-4 sm:px-8">
            <a href={tabletKioskUrl}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
              <ArrowLeft className="h-4 w-4" /> Voltar à seleção de pedidos
            </a>
          </div>
        )}

        <section className="px-5 py-5 sm:px-8">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">Carregando comprovante…</div>
          ) : !request ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
                <section className="rounded-xl border border-slate-300 bg-slate-50 p-4">
                  <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-800">
                    {request.recordType === 'order' || !request.recordType ? 'Dados do pedido' : 'Dados da retirada'}
                  </h2>
                  <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                    {request.recordType !== 'order' && request.recordType && (
                      <Info
                        label="Tipo de registro"
                        value={request.recordType === 'test' ? 'Registro de teste' : 'Saída avulsa'}
                      />
                    )}
                    {(request.recordType === 'order' || !request.recordType) && (
                      <>
                        <Info label="Nº do pedido" value={request.salesOrder} />
                        <Info label="Ordem de produção" value={request.orderCode} />
                      </>
                    )}
                    <Info label="Nome do cliente" value={request.customer} />
                    <Info label="Quantidade de equipamentos" value={String(request.equipmentQuantity)} />
                    <Info label="Quantidade de chips" value={String(request.chipQuantity)} />
                    <Info label="Tipo de bateria" value={request.batteryType || '—'} />
                    <Info label="Data de separação" value={formatDate(request.separationDate)} />
                  </div>
                </section>
                <section className="rounded-xl border border-slate-300 bg-white p-4">
                  <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-800">Observações</h2>
                  <p className="min-h-28 whitespace-pre-wrap text-xs leading-6 text-slate-700">
                    {request.observations || '—'}
                  </p>
                </section>
              </div>

              <div className="rounded-xl border border-slate-300 bg-slate-100 p-4">
                <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                  <Handshake className="h-4 w-4" /> Declaração de recebimento
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  Declaro que recebi os materiais e conferi as informações acima referentes à campanha pré-separada.
                </p>
                <div className="mt-3 flex flex-wrap items-baseline gap-2 border-b border-slate-400 pb-1 text-xs">
                  <span className="font-bold text-slate-700">Data da Retirada:</span>
                  <span className="font-semibold text-slate-900">{formatDate(request.pickupDate)}</span>
                </div>
              </div>

              {request.productionSignature ? (
                <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" /> Registro da Produção
                  </h2>
                  <p className="mt-2 text-xs text-emerald-900">
                    Assinado por <span className="font-bold">{request.productionSignature.name}</span> em {formatDateTime(request.productionSignature.signedAt)}.
                  </p>
                  <div className="mt-3 rounded-lg border-b border-emerald-300 bg-white px-3">
                    <img src={request.productionSignature.image} alt={`Assinatura de ${request.productionSignature.name}`} className="h-20 w-full object-contain object-left" />
                  </div>
                  <p className="mt-3 text-xs font-medium text-emerald-800">Comprovante em modo somente consulta. Não é possível assinar novamente.</p>
                </section>
              ) : (
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <PenLine className="h-4 w-4 text-emerald-700" />
                    Assinatura da Produção
                  </h2>
                  <label className="mt-3 block space-y-1.5 text-xs font-medium text-slate-700">
                    Nome completo
                    <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                  </label>
                  <div className="mt-3">
                    <SignaturePad onChange={setImage} />
                  </div>
                  <button type="button" onClick={() => void submitSignature()} disabled={saving}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
                    <CheckCircle2 className="h-4 w-4" /> {saving ? 'Salvando assinatura…' : 'Confirmar assinatura'}
                  </button>
                </section>
              )}

              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
              {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{success}</div>}

              <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">
                O comprovante fica registrado digitalmente com a data e o horário da assinatura.
              </div>
            </div>
          )}
        </section>
        {request && (
          <footer className="flex flex-wrap items-center justify-between gap-4 bg-emerald-800 px-5 py-3 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <PackageCheck className="h-8 w-8" />
              <div className="text-xs font-extrabold tracking-wide">
                CAMPANHA RETIRADA
                <span className="mt-0.5 block text-[9px] font-medium tracking-[0.2em] text-emerald-100">
                  {request.productionSignature ? 'MATERIAL CONFERIDO E RECEBIDO' : 'AGUARDANDO ASSINATURA DA PRODUÇÃO'}
                </span>
              </div>
            </div>
            <div className="min-w-[180px] rounded bg-white px-3 py-2 text-center text-slate-900">
              <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">Código da campanha</span>
              <span className="mt-0.5 block break-all font-mono text-xs font-bold">{request.campaignCode}</span>
            </div>
          </footer>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 pb-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
