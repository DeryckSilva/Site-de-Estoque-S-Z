export interface PickupZebraLabelData {
  orderNumber: string;
  customer: string;
  separationDate: string;
  equipmentQuantity: string;
  chipQuantity: string;
}

interface ZebraPrinterDevice {
  name: string;
  send: (
    data: string,
    onSuccess: () => void,
    onError: (error: unknown) => void
  ) => void;
}

interface ZebraBrowserPrintApi {
  getDefaultDevice: (
    deviceType: string,
    onSuccess: (device: ZebraPrinterDevice | null) => void,
    onError: (error: unknown) => void
  ) => void;
}

declare global {
  interface Window {
    BrowserPrint?: ZebraBrowserPrintApi;
  }
}

const browserPrintSdkPath = `${import.meta.env.BASE_URL}vendor/BrowserPrint-3.1.250.min.js`;
let browserPrintSdkPromise: Promise<ZebraBrowserPrintApi> | undefined;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'O serviço Zebra Browser Print retornou um erro sem detalhes.';
}

function loadBrowserPrintSdk(): Promise<ZebraBrowserPrintApi> {
  if (window.BrowserPrint) return Promise.resolve(window.BrowserPrint);
  if (browserPrintSdkPromise) return browserPrintSdkPromise;

  const sdkPromise = new Promise<ZebraBrowserPrintApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(browserPrintSdkPath, window.location.origin).toString();
    script.async = true;
    script.onload = () => {
      if (window.BrowserPrint) {
        resolve(window.BrowserPrint);
      } else {
        script.remove();
        reject(new Error('O arquivo do SDK Zebra Browser Print foi carregado, mas não inicializou.'));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(
        'O SDK JavaScript do Zebra Browser Print não está publicado. Instale o Browser Print oficial e coloque o arquivo BrowserPrint-3.1.250.min.js em public/vendor antes de publicar o site.'
      ));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    browserPrintSdkPromise = undefined;
    throw error;
  });

  browserPrintSdkPromise = sdkPromise;
  return sdkPromise;
}

function loadQrImage(qrCodeSvg: SVGSVGElement): Promise<HTMLImageElement> {
  const serializedSvg = new XMLSerializer().serializeToString(qrCodeSvg);
  const svgWithNamespace = serializedSvg.includes('xmlns=')
    ? serializedSvg
    : serializedSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const imageUrl = URL.createObjectURL(new Blob([svgWithNamespace], {
    type: 'image/svg+xml;charset=utf-8',
  }));

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('Não foi possível preparar o QR Code para impressão.'));
    };
    image.src = imageUrl;
  });
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      if (lines.length === maxLines) return lines;
      line = word;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): void {
  wrapText(context, text, maxWidth, maxLines).forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight, maxWidth);
  });
}

function drawLabelLandscape(
  data: PickupZebraLabelData,
  qrImage: HTMLImageElement
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 520;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('O navegador não conseguiu preparar a etiqueta para impressão.');

  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#111';
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(2, 2, 756, 516, 20);
  context.stroke();
  context.imageSmoothingEnabled = false;
  context.drawImage(qrImage, 20, 20, 296, 296);

  const textX = 332;
  const textWidth = 408;
  context.fillStyle = '#111';
  context.textBaseline = 'top';
  context.font = '800 22px Arial, sans-serif';
  context.fillText('RETIRADA · PRODUÇÃO', textX, 22, textWidth);
  context.fillStyle = '#555';
  context.font = '700 23px Arial, sans-serif';
  context.fillText('Nº DO PEDIDO', textX, 56, textWidth);
  context.fillStyle = '#111';
  context.font = '800 40px Arial, sans-serif';
  drawWrappedText(context, data.orderNumber, textX, 82, textWidth, 44, 2);

  context.strokeStyle = '#aaa';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(textX, 164);
  context.lineTo(textX + textWidth, 164);
  context.stroke();
  context.fillStyle = '#555';
  context.font = '700 23px Arial, sans-serif';
  context.fillText('DATA DE SEPARAÇÃO', textX, 176, textWidth);
  context.fillStyle = '#111';
  context.font = '700 30px Arial, sans-serif';
  context.fillText(data.separationDate, textX, 207, textWidth);

  context.strokeStyle = '#111';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(20, 330);
  context.lineTo(740, 330);
  context.stroke();

  context.fillStyle = '#111';
  context.font = '800 40px Arial, sans-serif';
  drawWrappedText(context, data.customer, 20, 350, 720, 42, 2);

  const quantityY = 444;
  const quantityHeight = 62;
  const quantityWidth = 352;
  const quantityBoxes = [
    { x: 20, label: 'EQUIPAMENTOS', value: data.equipmentQuantity },
    { x: 388, label: 'CHIPS', value: data.chipQuantity },
  ];

  for (const box of quantityBoxes) {
    context.strokeStyle = '#111';
    context.lineWidth = 2;
    context.strokeRect(box.x, quantityY, quantityWidth, quantityHeight);
    context.fillStyle = '#111';
    context.font = '700 22px Arial, sans-serif';
    context.fillText(box.label, box.x + 14, quantityY + 10, quantityWidth - 28);
    context.font = '800 36px Arial, sans-serif';
    context.fillText(box.value, box.x + 14, quantityY + 34, quantityWidth - 28);
  }

  return canvas;
}

function rotateLabelToPortrait(landscapeCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const portraitCanvas = document.createElement('canvas');
  portraitCanvas.width = 520;
  portraitCanvas.height = 760;
  const context = portraitCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('O navegador não conseguiu girar a etiqueta para impressão.');

  context.translate(portraitCanvas.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(landscapeCanvas, 0, 0);
  return portraitCanvas;
}

function canvasToZplGraphic(canvas: HTMLCanvasElement): string {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('O navegador não conseguiu converter a etiqueta para ZPL.');

  const { data: pixels } = context.getImageData(0, 0, canvas.width, canvas.height);
  const bytesPerRow = Math.ceil(canvas.width / 8);
  const hexadecimalBytes: string[] = [];

  for (let y = 0; y < canvas.height; y += 1) {
    for (let byteColumn = 0; byteColumn < bytesPerRow; byteColumn += 1) {
      let value = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = byteColumn * 8 + bit;
        if (x >= canvas.width) continue;
        const pixelOffset = (y * canvas.width + x) * 4;
        const darkness = 255 - (
          pixels[pixelOffset] * 0.299 +
          pixels[pixelOffset + 1] * 0.587 +
          pixels[pixelOffset + 2] * 0.114
        );
        if (darkness >= 128) value |= 1 << (7 - bit);
      }
      hexadecimalBytes.push(value.toString(16).padStart(2, '0').toUpperCase());
    }
  }

  const totalBytes = bytesPerRow * canvas.height;
  return `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hexadecimalBytes.join('')}^FS`;
}

export async function createPickupLabelZpl(
  data: PickupZebraLabelData,
  qrCodeSvg: SVGSVGElement
): Promise<string> {
  const qrImage = await loadQrImage(qrCodeSvg);
  const landscapeLabel = drawLabelLandscape(data, qrImage);
  const portraitLabel = rotateLabelToPortrait(landscapeLabel);
  const graphic = canvasToZplGraphic(portraitLabel);

  return [
    '^XA',
    '^PW520',
    '^LL760',
    '^LH0,0',
    '^PR4',
    '~SD30',
    `^FO0,0${graphic}`,
    '^PQ1',
    '^XZ',
  ].join('\n');
}

function getDefaultZebraPrinter(
  browserPrint: ZebraBrowserPrintApi
): Promise<ZebraPrinterDevice> {
  return new Promise((resolve, reject) => {
    browserPrint.getDefaultDevice(
      'printer',
      (device) => {
        if (!device) {
          reject(new Error('Nenhuma impressora padrão foi encontrada pelo Zebra Browser Print.'));
          return;
        }
        resolve(device);
      },
      (error) => reject(new Error(
        `Não foi possível conectar ao serviço local Zebra Browser Print. Confira se ele está instalado e aberto. ${getErrorMessage(error)}`
      ))
    );
  });
}

export async function printPickupLabelWithZebra(
  data: PickupZebraLabelData,
  qrCodeSvg: SVGSVGElement
): Promise<string> {
  const browserPrint = await loadBrowserPrintSdk();
  const printer = await getDefaultZebraPrinter(browserPrint);
  const zpl = await createPickupLabelZpl(data, qrCodeSvg);

  await new Promise<void>((resolve, reject) => {
    printer.send(zpl, resolve, (error) => {
      reject(new Error(`Falha ao enviar a etiqueta para ${printer.name}. ${getErrorMessage(error)}`));
    });
  });

  return printer.name;
}
