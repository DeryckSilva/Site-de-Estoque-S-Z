import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { Copy, Maximize2, Mic, RotateCcw, Send, Undo2 } from 'lucide-react';
import type {
  InventoryEntry,
  StockMovement,
  WarehouseObjectKind,
  WarehouseSceneObject,
  WmsData,
} from '../../types/wms';
import { DEFAULT_WAREHOUSE_LAYOUT, DEFAULT_WAREHOUSE_ROOM } from '../../types/wms';

type Props = {
  data: WmsData;
  onSave: (next: WmsData, message?: string) => void;
  onBack?: () => void;
  syncStatus: string;
  notice: string;
};

type SceneItem = WarehouseSceneObject & { color: string };
type Room = { width: number; length: number };
type SceneState = { room: Room; items: SceneItem[]; selectedId: string };
type SpeechRecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionErrorEvent = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};
type OrbitState = { x: number; y: number; moved: boolean };

const BASE_COLORS: Record<WarehouseObjectKind, string> = {
  rack: '#e9eaec',
  cabinet: '#f3f3f3',
  workbench: '#7a5c43',
  wall: '#e9ecef',
  door: '#cfd2d6',
  machine: '#8a9199',
  stairs: '#b0b5ba',
  box: '#b98a54',
  cart: '#2b5fb8',
  window: '#aed6e8',
};
const KIND_NAMES: Record<string, WarehouseObjectKind> = {
  estante: 'rack',
  rack: 'rack',
  prateleira: 'rack',
  armario: 'cabinet',
  mesa: 'workbench',
  bancada: 'workbench',
  maquina: 'machine',
  escada: 'stairs',
  caixa: 'box',
  carrinho: 'cart',
  porta: 'door',
  janela: 'window',
  window: 'window',
  parede: 'wall',
};
const COLOR_NAMES: Record<string, string> = {
  azul: '#2b5fb8',
  vermelho: '#c0392b',
  verde: '#2e8b57',
  amarelo: '#e0b400',
  branco: '#f3f3f3',
  preto: '#222222',
  cinza: '#8a9199',
  marrom: '#7a5c43',
};
const NUMBER_WORDS: Record<string, number> = {
  meio: 0.5, meia: 0.5, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

function normalizeText(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseNumber(value: string, fallback: number) {
  const match = value.match(/(\d+(?:[.,]\d+)?)|\b(meio|meia|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/);
  if (!match) return fallback;
  return match[1] ? Number(match[1].replace(',', '.')) : NUMBER_WORDS[match[2]] ?? fallback;
}

function rackKeyForLocation(location: string) {
  const normalized = location.trim().toLocaleUpperCase('pt-BR').replace(/\s+/g, '');
  const match = normalized.match(/^([A-Z])(\d{3,4})(\d{4})(00|10|20|30)$/);
  if (!match) return location.trim() || 'SEM POSIÇÃO';
  const rackNumber = Math.ceil(Number(match[2]) / 2);
  return `${match[1]}${String(rackNumber).padStart(3, '0')}`;
}

function isAvailable(entry: InventoryEntry) {
  return entry.quantity == null || entry.quantity > 0;
}

function formatStock(entries: InventoryEntry[]) {
  const summary = new Map<string, { code: string; name: string; boxes: number; units: number; pending: boolean }>();
  entries.filter(isAvailable).forEach((entry) => {
    const code = entry.itemCode || 'Sem SKU';
    const item = summary.get(code) ?? { code, name: entry.itemName || 'Item sem descrição', boxes: 0, units: 0, pending: false };
    item.boxes += Math.max(0, entry.boxCount);
    item.pending ||= entry.quantity == null;
    if (entry.unit === 'UN' && entry.quantity != null) item.units += entry.quantity * (entry.boxCount || 1);
    summary.set(code, item);
  });
  return [...summary.values()].sort((left, right) => left.code.localeCompare(right.code));
}

function readScene(data: WmsData): SceneState {
  const existing = data.layout ?? DEFAULT_WAREHOUSE_LAYOUT;
  const items: SceneItem[] = existing.map((item) => ({
    ...item,
    color: item.color ?? BASE_COLORS[item.type],
  }));
  const rackKeys = new Set(items.filter((item) => item.type === 'rack').map((item) => item.warehouseKey));
  [...new Set(data.entries.map((entry) => rackKeyForLocation(entry.location)))]
    .filter((key) => !rackKeys.has(key))
    .forEach((key, index) => {
      const number = Number(key.match(/(\d+)$/)?.[1] ?? 1);
      items.push({
        id: `rack-${key.replace(/\W/g, '-')}`,
        type: 'rack',
        label: key === 'SEM POSIÇÃO' ? 'SEM POSIÇÃO' : `ESTANTE ${number}`,
        warehouseKey: key,
        x: -0.9,
        y: 2 + index * 1.25,
        rotation: 90,
        width: 0.5,
        depth: 1.1,
        height: 2,
        color: BASE_COLORS.rack,
      });
    });
  return {
    room: data.room ?? DEFAULT_WAREHOUSE_ROOM,
    items,
    selectedId: items[0]?.id ?? '',
  };
}

function persistScene(scene: SceneState, data: WmsData, onSave: Props['onSave'], message: string) {
  const layout: WarehouseSceneObject[] = scene.items.map(({ color, ...item }) => ({ ...item, color }));
  onSave({ ...data, room: scene.room, layout }, message);
}

function makeLabel(text: string, detail?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = detail ? 112 : 72;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = 'rgba(22,31,36,.88)';
  context.beginPath();
  context.roundRect(0, 0, canvas.width, canvas.height, 14);
  context.fill();
  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.font = '600 32px system-ui';
  context.fillText(text.slice(0, 28), canvas.width / 2, 43);
  if (detail) {
    context.fillStyle = '#c8e8e8';
    context.font = '600 25px system-ui';
    context.fillText(detail.slice(0, 30), canvas.width / 2, 85);
  }
  const texture = new CanvasTexture(canvas);
  const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(detail ? 1.4 : 1.2, detail ? 0.31 : 0.2, 1);
  return sprite;
}

function addBox(parent: Group, width: number, height: number, depth: number, color: string, x: number, y: number, z: number) {
  const mesh = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshLambertMaterial({ color: new Color(color) }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function createObjectMesh(item: SceneItem, selected: boolean, stock: ReturnType<typeof formatStock>) {
  const group = new Group();
  const width = item.width ?? (item.type === 'rack' ? 0.5 : 0.7);
  const depth = item.depth ?? (item.type === 'rack' ? 1.2 : 0.8);
  const height = item.height ?? (item.type === 'rack' ? 2 : 0.9);
  const color = item.color ?? BASE_COLORS[item.type] ?? '#8a9199';
  if (item.type === 'rack') {
    const levels = 4;
    for (let index = 0; index < levels; index += 1) {
      const y = 0.1 + index * (height - 0.1) / (levels - 1);
      const shelf = addBox(group, width, 0.035, depth, color, 0, y, 0);
      shelf.material = new MeshStandardMaterial({
        color,
        roughness: 0.84,
        emissive: selected ? new Color('#0f6b6b') : new Color('#000000'),
        emissiveIntensity: selected ? 0.15 : 0,
      });
    }
    for (const xSide of [-1, 1]) {
      for (const zSide of [-1, 1]) {
        addBox(group, 0.045, height, 0.045, '#bfc4c9', xSide * (width / 2 - 0.03), height / 2, zSide * (depth / 2 - 0.03));
      }
    }
    stock.slice(0, levels).forEach((itemStock, index) => {
      if (!itemStock.boxes && !itemStock.units && !itemStock.pending) return;
      const carton = addBox(
        group,
        Math.min(width * 0.58, 0.27),
        0.16,
        Math.min(depth * 0.32, 0.32),
        '#b98a54',
        0,
        0.22 + index * (height - 0.3) / (levels - 1),
        0,
      );
      carton.userData.itemCode = itemStock.code;
      const detail = `${itemStock.code} · ${itemStock.boxes} cx`;
      const sprite = makeLabel(detail, itemStock.name);
      if (sprite) {
        sprite.position.set(0, carton.position.y + 0.19, 0);
        sprite.scale.set(0.7, 0.16, 1);
        group.add(sprite);
      }
    });
  } else {
    const mesh = addBox(group, width, height, depth, color, 0, height / 2, 0);
    const edge = new LineSegments(
      new EdgesGeometry(mesh.geometry),
      new LineBasicMaterial({ color: selected ? '#0f6b6b' : '#44505a', linewidth: selected ? 3 : 1 }),
    );
    edge.position.copy(mesh.position);
    group.add(edge);
  }
  const label = makeLabel(item.label);
  if (label) {
    label.position.set(0, height + 0.26, 0);
    group.add(label);
  }
  if (item.type === 'window') {
    const windowMesh = group.children.find((child) => child instanceof Mesh);
    if (windowMesh instanceof Mesh) {
      windowMesh.material.dispose();
      windowMesh.material = new MeshLambertMaterial({
        color,
        emissive: new Color('#6caac0'),
        emissiveIntensity: selected ? 0.18 : 0.08,
        transparent: true,
        opacity: 0.72,
      });
    }
  }
  group.position.set(item.x, item.elevation ?? 0, item.y);
  group.rotation.y = (item.rotation * Math.PI) / 180;
  group.userData.sceneItemId = item.id;
  group.traverse((child) => {
    child.userData.sceneItemId = item.id;
  });
  return group;
}

function getObjectSize(item: SceneItem, field: 'width' | 'depth' | 'height') {
  const defaults = item.type === 'rack'
    ? { width: 0.5, depth: 1.2, height: 2 }
    : item.type === 'window'
      ? { width: 0.1, depth: 1, height: 0.9 }
      : item.type === 'cabinet'
        ? { width: 0.5, depth: 0.9, height: 1.6 }
        : item.type === 'workbench'
          ? { width: 0.7, depth: 1.4, height: 0.75 }
          : { width: 0.6, depth: 0.7, height: 0.9 };
  return item[field] ?? defaults[field];
}

function clampItemToRoom(item: SceneItem, room: Room) {
  const width = item.rotation === 90 ? getObjectSize(item, 'depth') : getObjectSize(item, 'width');
  const depth = item.rotation === 90 ? getObjectSize(item, 'width') : getObjectSize(item, 'depth');
  const roomStart = -2.5;
  const clampAxis = (value: number, halfSize: number, start: number, size: number) => {
    if (halfSize * 2 >= size) return start + size / 2;
    return Math.max(start + halfSize, Math.min(start + size - halfSize, value));
  };
  item.x = clampAxis(item.x, width / 2, -room.width / 2, room.width);
  item.y = clampAxis(item.y, depth / 2, roomStart, room.length);
}

function makeNewItem(type: string, name: string, id: string, x: number, z: number): SceneItem {
  const templates: Record<string, { type: WarehouseObjectKind; width: number; depth: number; height: number; color: string }> = {
    rack: { type: 'rack', width: 0.5, depth: 1.2, height: 2, color: BASE_COLORS.rack },
    cabinet: { type: 'cabinet', width: 0.5, depth: 0.9, height: 1.6, color: BASE_COLORS.cabinet },
    workbench: { type: 'workbench', width: 0.7, depth: 1.4, height: 0.75, color: BASE_COLORS.workbench },
    door: { type: 'door', width: 0.9, depth: 0.1, height: 2.1, color: BASE_COLORS.door },
    wall: { type: 'wall', width: 0.08, depth: 1, height: 2.7, color: BASE_COLORS.wall },
    machine: { type: 'machine', width: 0.6, depth: 0.7, height: 0.9, color: BASE_COLORS.machine },
    stairs: { type: 'stairs', width: 0.5, depth: 0.5, height: 1.2, color: BASE_COLORS.stairs },
    box: { type: 'box', width: 0.4, depth: 0.4, height: 0.3, color: BASE_COLORS.box },
    cart: { type: 'cart', width: 0.5, depth: 0.4, height: 1.2, color: BASE_COLORS.cart },
    window: { type: 'window', width: 0.1, depth: 1, height: 0.9, color: BASE_COLORS.window },
  };
  const template = templates[type] ?? templates.cabinet;
  return {
    id,
    type: template.type,
    label: name,
    x,
    y: z,
    rotation: 0,
    width: template.width,
    depth: template.depth,
    height: template.height,
    elevation: type === 'window' ? 1 : 0,
    color: template.color,
  };
}

export function WarehouseThreeMap({ data, onSave, onBack, syncStatus, notice }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const groupRef = useRef<Group | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const orbitRef = useRef<OrbitState | null>(null);
  const historyRef = useRef<string[]>([]);
  const currentStateRef = useRef<SceneState | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [sceneState, setSceneState] = useState(() => readScene(data));
  const [command, setCommand] = useState('');
  const [log, setLog] = useState('');
  const [logError, setLogError] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const [transferEntryId, setTransferEntryId] = useState('');
  const [transferDestinationId, setTransferDestinationId] = useState('');
  const [transferBoxCount, setTransferBoxCount] = useState('1');

  const stock = useMemo(() => formatStock(data.entries), [data.entries]);
  const selectedItem = sceneState.items.find((item) => item.id === sceneState.selectedId);
  const selectedStock = useMemo(() => {
    if (!selectedItem?.warehouseKey) return [];
    return data.entries.filter((entry) =>
      rackKeyForLocation(entry.location) === selectedItem.warehouseKey && isAvailable(entry),
    );
  }, [data.entries, selectedItem]);
  const rackOptions = sceneState.items.filter((item) => item.type === 'rack' && item.warehouseKey);
  const totalBoxes = data.entries.reduce((sum, entry) =>
    sum + (entry.quantity != null && entry.unit === 'UN' ? Math.max(0, entry.boxCount) : 0), 0);
  const totalUnits = data.entries.reduce((sum, entry) =>
    sum + (entry.quantity != null && entry.unit === 'UN' ? entry.quantity * (entry.boxCount || 1) : 0), 0);

  useEffect(() => {
    currentStateRef.current = sceneState;
  }, [sceneState]);

  useEffect(() => {
    const nextFromProps = readScene(data);
    const current = currentStateRef.current;
    if (current?.items.length) {
      nextFromProps.selectedId = nextFromProps.items.some((item) => item.id === current.selectedId)
        ? current.selectedId
        : nextFromProps.selectedId;
    }
    currentStateRef.current = nextFromProps;
    setSceneState(nextFromProps);
  }, [data.layout, data.room]);

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    const scene = new Scene();
    scene.background = new Color('#e9ecef');
    const camera = new PerspectiveCamera(48, 1, 0.1, 100);
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = 'srgb';
    renderer.setClearColor('#e9ecef', 1);
    renderer.domElement.setAttribute('aria-label', 'Planta tridimensional do estoque. Arraste para girar e use a roda do mouse para aproximar.');
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);
    scene.add(new HemisphereLight(0xffffff, 0x8890a0, 1.4));
    const ambient = new AmbientLight(0xffffff, 0.35);
    scene.add(ambient);
    const directional = new DirectionalLight(0xffffff, 1.5);
    directional.position.set(3, 8, -4);
    scene.add(directional);
    const group = new Group();
    scene.add(group);
    rendererRef.current = renderer;
    cameraRef.current = camera;
    sceneRef.current = scene;
    groupRef.current = group;

    const target = new Vector3(0, 0.7, 2);
    let azimuth = 0.45;
    let elevation = 0.72;
    let distance = 11;
    let frame = 0;
    const placeCamera = () => {
      camera.position.set(
        target.x + distance * Math.sin(azimuth) * Math.cos(elevation),
        target.y + distance * Math.sin(elevation),
        target.z - distance * Math.cos(azimuth) * Math.cos(elevation),
      );
      camera.lookAt(target);
    };
    const draw = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      placeCamera();
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(host);
    const renderLoop = () => {
      draw();
      frame = window.requestAnimationFrame(renderLoop);
    };
    frame = window.requestAnimationFrame(renderLoop);

    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      orbitRef.current = { x: event.clientX, y: event.clientY, moved: false };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      const drag = orbitRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) {
        azimuth -= dx * 0.008;
        elevation = Math.max(0.15, Math.min(1.5, elevation + dy * 0.006));
        drag.x = event.clientX;
        drag.y = event.clientY;
        draw();
      }
    };
    const pointerUp = (event: PointerEvent) => {
      const drag = orbitRef.current;
      if (drag && !drag.moved) {
        const bounds = renderer.domElement.getBoundingClientRect();
        const pointer = new Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        raycasterRef.current.setFromCamera(pointer, camera);
        const intersections = raycasterRef.current.intersectObjects(group.children, true);
        const pickedId = intersections.map((intersection) => intersection.object.userData.sceneItemId)
          .find((id): id is string => typeof id === 'string');
        if (pickedId) {
          setSceneState((current) => {
            const next = { ...current, selectedId: pickedId };
            currentStateRef.current = next;
            return next;
          });
        }
      }
      orbitRef.current = null;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = Math.max(3, Math.min(24, distance * (1 + event.deltaY * 0.001)));
      draw();
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('wheel', wheel, { passive: false });

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('wheel', wheel);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
      groupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((object) => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ('map' in material && material.map) material.map.dispose();
            material.dispose();
          });
        } else if (object instanceof Sprite) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ('map' in material && material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
    }

    const { room } = sceneState;
    const floor = new Mesh(
      new BoxGeometry(room.width, 0.025, room.length),
      new MeshLambertMaterial({ color: '#dfe3e6' }),
    );
    floor.position.set(0, -0.02, (room.length / 2) - 2.5);
    group.add(floor);
    const grid = new Mesh(
      new BoxGeometry(room.width - 0.1, 0.002, room.length - 0.1),
      new MeshLambertMaterial({ color: '#d2d8dc', wireframe: true }),
    );
    grid.position.copy(floor.position);
    grid.position.y += 0.015;
    group.add(grid);

    const roomStart = -2.5;
    const roomEnd = roomStart + room.length;
    const wallHeight = 2.7;
    const wallMaterial = new MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, side: 2 });
    const sideWallGeometry = new BoxGeometry(0.04, wallHeight, room.length);
    const leftWall = new Mesh(sideWallGeometry, wallMaterial);
    leftWall.position.set(-room.width / 2, wallHeight / 2, (roomStart + roomEnd) / 2);
    const rightWall = new Mesh(sideWallGeometry, wallMaterial.clone());
    rightWall.position.set(room.width / 2, wallHeight / 2, (roomStart + roomEnd) / 2);
    const backWall = new Mesh(new BoxGeometry(room.width, wallHeight, 0.04), wallMaterial.clone());
    backWall.position.set(0, wallHeight / 2, roomEnd);
    group.add(leftWall, rightWall, backWall);

    const itemsWithStock = sceneState.items.map((item) => ({
      ...item,
      color: item.color ?? BASE_COLORS[item.type],
    }));
    itemsWithStock.forEach((item) => {
      const linked = item.warehouseKey
        ? data.entries.filter((entry) => rackKeyForLocation(entry.location) === item.warehouseKey && isAvailable(entry))
        : [];
      group.add(createObjectMesh(item, item.id === sceneState.selectedId, formatStock(linked)));
    });
  }, [data.entries, sceneState]);

  useEffect(() => {
    const container = hostRef.current?.parentElement;
    const onFullscreenChange = () => setFullScreen(document.fullscreenElement === container);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const setMessage = useCallback((message: string, error = false) => {
    setLog(message);
    setLogError(error);
  }, []);

  const saveState = useCallback((next: SceneState, message: string) => {
    currentStateRef.current = next;
    setSceneState(next);
    persistScene(next, data, onSave, message);
  }, [data, onSave]);

  const pushHistory = useCallback(() => {
    const current = currentStateRef.current;
    if (!current) return;
    historyRef.current.push(JSON.stringify(current));
    if (historyRef.current.length > 40) historyRef.current.shift();
  }, []);

  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) {
      setMessage('Nada para desfazer.', true);
      return;
    }
    const next = JSON.parse(previous) as SceneState;
    saveState(next, 'Alteração desfeita.');
    setMessage('Desfeito.');
  }, [saveState, setMessage]);

  const findTarget = (text: string, items: SceneItem[]) => {
    let target: SceneItem | undefined;
    for (const item of items) {
      const label = normalizeText(item.label);
      if (label && text.includes(label) && (!target || label.length > normalizeText(target.label).length)) target = item;
    }
    if (target) return target;
    const typeKey = Object.keys(KIND_NAMES).find((type) => text.includes(type));
    return typeKey ? items.find((item) => item.type === KIND_NAMES[typeKey]) : undefined;
  };

  const executeCommand = useCallback((rawCommand: string) => {
    const text = normalizeText(rawCommand.trim());
    if (!text) return;
    if (/^(desfaz|desfazer|volta|voltar)\b/.test(text)) {
      undo();
      return;
    }
    const current = currentStateRef.current;
    if (!current) return;
    const next: SceneState = { room: { ...current.room }, items: current.items.map((item) => ({ ...item })), selectedId: current.selectedId };
    const announce = (message: string) => {
      pushHistory();
      saveState(next, message);
      setMessage(message);
    };

    const roomMatch = text.match(/^sala\b.*?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?\s*(?:por|x|e)\s*(\d+(?:[.,]\d+)?)/);
    if (roomMatch) {
      next.room.width = Math.max(1, Number(roomMatch[1].replace(',', '.')));
      next.room.length = Math.max(2, Number(roomMatch[2].replace(',', '.')));
      next.items.forEach((sceneItem) => clampItemToRoom(sceneItem, next.room));
      announce(`Sala ajustada para ${next.room.width} × ${next.room.length} m.`);
      return;
    }

    const addMatch = text.match(/^(?:adicionar|adiciona|criar|cria|colocar|coloca|incluir|inclua|botar|por)\s+(?:um |uma |o |a )?([a-z]+)(.*)$/);
    if (addMatch) {
      const typeName = Object.keys(KIND_NAMES).find((type) => addMatch[1].startsWith(type));
      if (!typeName) {
        setMessage(`Não reconheci o objeto “${addMatch[1]}”. Tente estante, armário, mesa, máquina, escada, caixa, carrinho, porta ou janela.`, true);
        return;
      }
      const type = KIND_NAMES[typeName];
      const labelMatch = rawCommand.match(/chamad[oa]\s+(.+?)(?:\s+(?:de|no|na|ao|com|a)\s|$)/i);
      const typeCount = next.items.filter((item) => item.type === type).length;
      const label = labelMatch?.[1]?.trim() || `${typeName[0].toUpperCase()}${typeName.slice(1)}${typeCount ? ` ${typeCount + 1}` : ''}`;
      const newItem = makeNewItem(type, label, crypto.randomUUID(), 0, 2);
      if (type === 'rack') {
        const rackIndex = Math.max(4, ...next.items.map((candidate) =>
          Number(candidate.warehouseKey?.match(/^[A-Z](\d+)$/)?.[1] ?? 0),
        )) + 1;
        newItem.warehouseKey = `A${String(rackIndex).padStart(3, '0')}`;
      }
      const roomStart = -2.5;
      if (/\bfundo\b/.test(addMatch[2])) newItem.y = roomStart + next.room.length - newItem.depth! / 2;
      else if (/\b(entrada|frente)\b/.test(addMatch[2])) newItem.y = roomStart + newItem.depth! / 2;
      else if (/\besquerda\b/.test(addMatch[2])) newItem.x = next.room.width / 2 - newItem.width! / 2;
      else if (/\bdireita\b/.test(addMatch[2])) newItem.x = -next.room.width / 2 + newItem.width! / 2;
      const dimensionMatch = addMatch[2].match(/(\d+(?:[.,]\d+)?)\s*(?:m\b|metro)/);
      if (dimensionMatch) newItem.depth = Math.max(0.1, Number(dimensionMatch[1].replace(',', '.')));
      clampItemToRoom(newItem, next.room);
      next.items.push(newItem);
      next.selectedId = newItem.id;
      announce(`Adicionado: ${newItem.label}.`);
      return;
    }

    const rename = text.match(/^renome\w*\s+(.+?)\s+para\s+(.+)$/);
    const targetText = rename?.[1] ?? text;
    const item = findTarget(targetText, next.items);
    if (!item) {
      setMessage(`Não entendi “${rawCommand}”. Cite o nome de um objeto da planta.`, true);
      return;
    }
    next.selectedId = item.id;
    if (rename) {
      const original = rawCommand.match(/para\s+(.+)$/i)?.[1]?.trim();
      if (!original) {
        setMessage('Informe o novo nome depois de “para”.', true);
        return;
      }
      item.label = original;
      announce(`Renomeado para ${original}.`);
      return;
    }

    if (/^(apagar|apague|remover|remova|deletar|excluir)\b/.test(text)) {
      if (item.type === 'rack' && data.entries.some((entry) => rackKeyForLocation(entry.location) === item.warehouseKey && isAvailable(entry))) {
        setMessage('Este rack ainda tem estoque vinculado. Mova o saldo antes de apagá-lo.', true);
        return;
      }
      next.items = next.items.filter((candidate) => candidate.id !== item.id);
      next.selectedId = next.items[0]?.id ?? '';
      announce(`${item.label} removido.`);
      return;
    }
    if (/^(girar|gire|rotacionar|rotacione|virar|vire)\b/.test(text)) {
      item.rotation = item.rotation === 0 ? 90 : 0;
      [item.width, item.depth] = [item.depth, item.width];
      clampItemToRoom(item, next.room);
      announce(`${item.label} girado.`);
      return;
    }
    if (/^(pintar|pinte|mudar|mude|trocar|troque)\b/.test(text)) {
      const colorName = Object.keys(COLOR_NAMES).find((name) => text.includes(name));
      if (!colorName) {
        setMessage('Informe a cor: azul, vermelho, verde, amarelo, branco, preto, cinza ou marrom.', true);
        return;
      }
      item.color = COLOR_NAMES[colorName];
      announce(`${item.label} agora está ${colorName}.`);
      return;
    }
    if (/^(aumentar|aumente|alargar|alargue|crescer|estender|diminuir|reduzir|encurtar)\b/.test(text)) {
      const rest = text.replace(normalizeText(item.label), '');
      const decrease = /^(diminuir|reduzir|encurtar)/.test(text);
      const amount = parseNumber(rest, 0.5) * (decrease ? -1 : 1);
      const field = text.includes('largura') ? 'width' : text.includes('altura') ? 'height' : 'depth';
      const nextSize = Math.max(0.1, getObjectSize(item, field) + amount);
      item[field] = Number(nextSize.toFixed(2));
      clampItemToRoom(item, next.room);
      announce(`${item.label} redimensionado.`);
      return;
    }
    if (/^(mover|mova|movimentar|empurrar|deslocar|levar|passar|colocar|pôr)\b/.test(text) ||
        /\b(para|à|a)\s+(esquerda|direita|fundo|frente)\b/.test(text)) {
      const direction = text.match(/\b(esquerda|direita|fundo|frente)\b/)?.[1];
      if (!direction) {
        setMessage(`Informe a direção para mover ${item.label}: esquerda, direita, fundo ou frente.`, true);
        return;
      }
      const amount = parseNumber(text.replace(normalizeText(item.label), ''), 0.5);
      if (direction === 'esquerda') item.x += amount;
      if (direction === 'direita') item.x -= amount;
      if (direction === 'fundo') item.y += amount;
      if (direction === 'frente') item.y -= amount;
      clampItemToRoom(item, next.room);
      announce(`${item.label} movido para ${direction}.`);
      return;
    }
    setMessage(`Não entendi o que fazer com ${item.label}. Tente mover, girar, pintar, aumentar, renomear ou apagar.`, true);
  }, [data.entries, pushHistory, saveState, setMessage, undo]);

  const submitCommand = () => {
    executeCommand(command);
    setCommand('');
  };

  const startVoice = () => {
    const windowWithSpeech = window as SpeechRecognitionWindow;
    const Recognition = windowWithSpeech.SpeechRecognition ?? windowWithSpeech.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage('O reconhecimento de voz não está disponível neste navegador. Digite o comando.', true);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setCommand(transcript);
      executeCommand(transcript);
      setCommand('');
    };
    recognition.onerror = (event) => {
      setMessage(`Não consegui ouvir (${event.error}). Verifique a permissão do microfone.`, true);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setMessage('Ouvindo… diga um comando para editar a planta.');
    } catch (error) {
      console.error('Falha ao iniciar reconhecimento de voz:', error);
      setMessage('Não foi possível iniciar o microfone. Verifique a permissão do navegador.', true);
    }
  };

  const toggleFullscreen = async () => {
    const target = hostRef.current?.parentElement;
    if (!target) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch (error) {
      console.error('Falha ao alternar tela cheia:', error);
      setMessage('Não foi possível abrir a planta em tela cheia neste navegador.', true);
    }
  };

  const addObject = (type: string) => {
    const current = currentStateRef.current;
    if (!current) return;
    const next = { ...current, items: current.items.map((item) => ({ ...item })) };
    const kind = KIND_NAMES[type];
    const index = next.items.filter((item) => item.type === kind).length;
    const kindLabel = type === 'window' ? 'Janela' : type;
    const label = type === 'rack' ? `Estante ${index + 1}` : `${kindLabel[0].toUpperCase()}${kindLabel.slice(1)}${index ? ` ${index + 1}` : ''}`;
    const item = makeNewItem(
      kind,
      label,
      crypto.randomUUID(),
      type === 'rack' ? -0.9 : type === 'window' ? -next.room.width / 2 + 0.05 : 0,
      type === 'window' ? -0.85 : 1 + index,
    );
    if (kind === 'rack') {
      const rackIndex = Math.max(4, ...next.items.map((candidate) =>
        Number(candidate.warehouseKey?.match(/^[A-Z](\d+)$/)?.[1] ?? 0),
      )) + 1;
      item.warehouseKey = `A${String(rackIndex).padStart(3, '0')}`;
    }
    clampItemToRoom(item, next.room);
    next.items.push(item);
    next.selectedId = item.id;
    pushHistory();
    saveState(next, `${item.label} adicionado à planta.`);
    setMessage(`${item.label} adicionado à planta.`);
  };

  const selectedItemEntries = useMemo(() => {
    if (!selectedItem?.warehouseKey) return [];
    return data.entries.filter((entry) =>
      rackKeyForLocation(entry.location) === selectedItem.warehouseKey && isAvailable(entry),
    );
  }, [data.entries, selectedItem]);

  const moveSelectedStock = (entryId: string, destinationKey: string, boxCount: number) => {
    const source = data.entries.find((entry) => entry.id === entryId);
    if (!source || !destinationKey) return;
    const destination = data.layout?.find((item) => item.warehouseKey === destinationKey);
    if (!destination) {
      setMessage('Selecione um rack de destino válido.', true);
      return;
    }
    const locationMatch = source.location.match(/^([A-Z])(\d{3,4})(\d{4})(00|10|20|30)$/);
    if (!locationMatch) {
      setMessage('O endereço de origem não segue o padrão do WMS.', true);
      return;
    }
    const section = Number(destinationKey.slice(1)) * 2 - (Number(locationMatch[2]) % 2 ? 1 : 0);
    const destinationLocation = `${destinationKey[0]}${String(section).padStart(3, '0')}${locationMatch[3]}${locationMatch[4]}`;
    if (source.quantity == null || source.quantity <= 0) {
      setMessage('Confira o saldo do lote no WMS antes de movimentá-lo.', true);
      return;
    }
    if (source.boxCount > 0 && (!Number.isInteger(boxCount) || boxCount < 1 || boxCount > source.boxCount)) {
      setMessage(`Informe uma quantidade de caixas entre 1 e ${source.boxCount}.`, true);
      return;
    }
    const boxesToMove = source.boxCount > 0 ? boxCount : 0;
    const moved = { ...source, id: crypto.randomUUID(), location: destinationLocation };
    let remaining = { ...source };
    if (source.boxCount > 0) {
      moved.boxCount = boxesToMove;
      const boxesLeft = source.boxCount - boxesToMove;
      remaining = boxesLeft
        ? { ...source, boxCount: boxesLeft }
        : { ...source, boxCount: 0, quantity: 0, rawQuantity: '0', status: 'TRANSFERIDO' };
    } else {
      remaining = { ...source, quantity: 0, rawQuantity: '0', status: 'TRANSFERIDO' };
    }
    const destinationMatch = data.entries.find((candidate) =>
      candidate.id !== source.id &&
      candidate.location === destinationLocation &&
      candidate.itemCode === source.itemCode &&
      candidate.lot === source.lot &&
      candidate.quantity === moved.quantity &&
      candidate.unit === source.unit &&
      candidate.serialized === source.serialized,
    );
    const entries = data.entries.map((entry) => {
      if (entry.id === source.id) return remaining;
      if (entry.id !== destinationMatch?.id) return entry;
      return {
        ...entry,
        boxCount: entry.boxCount + moved.boxCount,
        serials: [...entry.serials, ...moved.serials],
      };
    });
    if (!destinationMatch) entries.push(moved);
    const movement: StockMovement = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      kind: 'transferencia',
      itemCode: source.itemCode,
      itemName: source.itemName,
      lot: source.lot,
      locationFrom: source.location,
      locationTo: destinationLocation,
      quantity: (source.quantity ?? 0) * (boxesToMove || 1),
      unit: source.unit,
      reference: 'Movimentação pela planta 3D',
      serials: source.serials,
      wallBarcode: '',
      productionOrderCode: '',
    };
    onSave({ ...data, entries, movements: [movement, ...data.movements] }, `Lote ${source.lot} movido para ${destination.label}.`);
    setMessage(`Lote ${source.lot} movido para ${destination.label}.`);
  };

  const copyJson = async () => {
    const current = currentStateRef.current;
    if (!current) return;
    const json = JSON.stringify({ room: current.room, items: current.items }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setJsonText('');
      setMessage('JSON da planta copiado.');
    } catch (error) {
      console.error('Falha ao copiar JSON da planta:', error);
      setJsonText(json);
      setMessage('Não foi possível copiar automaticamente. O JSON está disponível abaixo.', true);
    }
  };

  const objectKinds: Array<{ type: string; label: string }> = [
    { type: 'rack', label: 'Estante' },
    { type: 'cabinet', label: 'Armário' },
    { type: 'workbench', label: 'Mesa' },
    { type: 'machine', label: 'Máquina' },
    { type: 'stairs', label: 'Escada' },
    { type: 'box', label: 'Caixa' },
    { type: 'cart', label: 'Carrinho' },
    { type: 'door', label: 'Porta' },
    { type: 'window', label: 'Janela' },
  ];

  return (
    <section className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-slate-300 bg-[#e9ecef] text-[#1d2328]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-white px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <h1 className="text-base font-bold sm:text-lg">Planta 3D do estoque</h1>
          <p className="text-[11px] text-slate-500">Arraste para girar · role para aproximar · selecione objetos e edite por comando</p>
        </div>
        <div className="flex items-center gap-2">
          {onBack && <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs hover:bg-slate-100">Voltar ao WMS</button>}
          <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs hover:bg-slate-100"><Maximize2 className="h-4 w-4" />Tela cheia</button>
        </div>
      </header>

      <div className="relative min-h-[380px] flex-1 bg-[#e9ecef] sm:min-h-[500px]">
        <div ref={hostRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-white/75 px-2 py-1 text-[10px] text-slate-600">
          Arraste para girar · role para aproximar · <span className="font-semibold">Sala {sceneState.room.width} × {sceneState.room.length} m</span>
        </div>
      </div>

      <footer className="grid gap-2 border-t border-slate-300 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {objectKinds.map((item) => (
            <button key={item.type} type="button" onClick={() => addObject(item.type)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100">+ {item.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={startVoice} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-white ${isListening ? 'animate-pulse bg-rose-600' : 'bg-[#0f6b6b] hover:bg-teal-800'}`} title="Falar comando"><Mic className="h-4 w-4" />{isListening ? 'Ouvindo…' : 'Falar'}</button>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') submitCommand(); }}
            placeholder="Ex.: mover estante principal para a esquerda 0,5 metro"
            aria-label="Comando para editar a planta"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-[#f8f9fa] px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
          />
          <button type="button" onClick={submitCommand} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-[#f8f9fa] px-3 py-2 text-xs hover:bg-slate-100"><Send className="h-4 w-4" />Enviar</button>
        </div>
        <div role="status" aria-live="polite" className={`min-h-5 text-xs ${logError ? 'text-red-700' : 'text-slate-700'}`}>{log || notice || syncStatus}</div>
        <div className="max-h-12 overflow-auto text-[10px] leading-relaxed text-slate-500">
          <span className="font-semibold">Comandos:</span> adicionar caixa chamada Lote 7 no fundo · mover estante principal para a esquerda 0,5 metro · aumentar estante 1 metro · girar mesa · pintar caixa de azul · renomear mesa para Bancada · apagar escada · sala 2,4 por 9 · desfazer
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={undo} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100"><Undo2 className="h-4 w-4" />Desfazer</button>
          <button type="button" onClick={() => void copyJson()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100"><Copy className="h-4 w-4" />Copiar JSON</button>
          <span className="ml-auto text-[10px] text-slate-500">{syncStatus} · {totalBoxes} caixas · {totalUnits.toLocaleString('pt-BR')} unidades</span>
        </div>
        {jsonText && <textarea readOnly value={jsonText} aria-label="JSON da planta" rows={5} className="w-full rounded border border-slate-300 bg-slate-50 p-2 font-mono text-[10px]" />}

        {selectedItem && selectedItem.type === 'rack' && (
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold text-slate-500">SKU / LOTE NO RACK SELECIONADO
                <select value={transferEntryId} onChange={(event) => { setTransferEntryId(event.target.value); setTransferBoxCount('1'); }} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800">
                  <option value="">Selecionar saldo…</option>
                  {selectedStock.map((entry) => <option key={entry.id} value={entry.id}>{entry.itemCode} · lote {entry.lot} · {entry.boxCount} cx</option>)}
                </select>
              </label>
              {transferEntryId && (() => {
                const entry = selectedStock.find((candidate) => candidate.id === transferEntryId);
                return entry?.boxCount ? (
                  <label className="block text-[10px] font-semibold text-slate-500">CAIXAS A MOVER (DE {entry.boxCount})
                    <input type="number" min="1" max={entry.boxCount} step="1" value={transferBoxCount} onChange={(event) => setTransferBoxCount(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800" />
                  </label>
                ) : null;
              })()}
              <label className="block text-[10px] font-semibold text-slate-500">DESTINO
                <select value={transferDestinationId} onChange={(event) => setTransferDestinationId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800">
                  <option value="">Selecionar outro rack…</option>
                  {rackOptions.filter((rack) => rack.id !== selectedItem.id).map((rack) => <option key={rack.id} value={rack.id}>{rack.label}</option>)}
                </select>
              </label>
              <button type="button" disabled={!transferEntryId || !transferDestinationId} onClick={() => {
                const destination = rackOptions.find((rack) => rack.id === transferDestinationId);
                if (destination?.warehouseKey) moveSelectedStock(transferEntryId, destination.warehouseKey, Number(transferBoxCount));
              }} className="w-full rounded-lg bg-[#0f6b6b] px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">Mover caixas no WMS</button>
            </div>
            <div className="max-h-20 overflow-auto rounded border border-slate-200 bg-white p-2 text-[10px] text-slate-600">
              {formatStock(selectedStock).map((item) => <div key={item.code}>{item.code} · {item.boxes} cx · {item.units.toLocaleString('pt-BR')} un</div>)}
              {!selectedStock.length && 'Sem saldo vinculado.'}
            </div>
          </div>
        )}
      </footer>
    </section>
  );
}
