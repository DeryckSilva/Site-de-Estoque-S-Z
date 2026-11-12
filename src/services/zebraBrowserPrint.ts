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

function encodeZplField(value: string): string {
  const safeValue = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return Array.from(new TextEncoder().encode(safeValue), (byte) =>
    `_${byte.toString(16).padStart(2, '0').toUpperCase()}`
  ).join('');
}

export function createPickupLabelZpl(data: PickupZebraLabelData, signatureUrl: string): string {
  return [
    '^XA',
    '^CI28',
    '^PW520',
    '^LL760',
    '^LH0,0',
    '^PR4',
    '~SD30',
    '^FO20,20^GB480,275,2^FS',
    `^FO32,32^BQN,2,4^FH_^FDQA,${encodeZplField(signatureUrl)}^FS`,
    `^FO270,38^A0N,20,18^FH_^FD${encodeZplField('ETIQUETA DE RETIRADA')}^FS`,
    `^FO270,78^A0N,18,17^FH_^FD${encodeZplField('Nº DO PEDIDO')}^FS`,
    `^FO270,105^A0N,30,22^FB215,2,0,L,0^FH_^FD${encodeZplField(data.orderNumber)}^FS`,
    `^FO270,185^A0N,18,17^FH_^FD${encodeZplField('DATA DE SEPARAÇÃO')}^FS`,
    `^FO270,212^A0N,24,21^FB215,2,0,L,0^FH_^FD${encodeZplField(data.separationDate)}^FS`,
    '^FO20,315^GB480,3,3^FS',
    `^FO20,338^A0N,36,31^FB480,2,2,L,0^FH_^FD${encodeZplField(data.customer)}^FS`,
    '^FO20,470^GB232,250,2^FS',
    '^FO268,470^GB232,250,2^FS',
    `^FO35,495^A0N,20,18^FH_^FD${encodeZplField('EQUIPAMENTOS')}^FS`,
    `^FO35,545^A0N,52,45^FB200,2,0,L,0^FH_^FD${encodeZplField(data.equipmentQuantity)}^FS`,
    `^FO283,495^A0N,20,18^FH_^FD${encodeZplField('CHIPS')}^FS`,
    `^FO283,545^A0N,52,45^FB200,2,0,L,0^FH_^FD${encodeZplField(data.chipQuantity)}^FS`,
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
  signatureUrl: string
): Promise<string> {
  const browserPrint = await loadBrowserPrintSdk();
  const printer = await getDefaultZebraPrinter(browserPrint);
  const zpl = createPickupLabelZpl(data, signatureUrl);

  await new Promise<void>((resolve, reject) => {
    printer.send(zpl, resolve, (error) => {
      reject(new Error(`Falha ao enviar a etiqueta para ${printer.name}. ${getErrorMessage(error)}`));
    });
  });

  return printer.name;
}
