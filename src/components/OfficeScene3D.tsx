import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { BotId, BotStatus, EmployeeProfile, OfficeMetrics } from '../shared/types';

interface OfficeScene3DProps {
  employees: EmployeeProfile[];
  metrics: OfficeMetrics;
  theme: 'light' | 'dark';
  selectedBotId: BotId | null;
  onSelectBot: (botId: BotId) => void;
}

type CameraPresetId =
  | 'overview'
  | 'reception'
  | 'ceo'
  | 'meeting'
  | 'billiard'
  | 'pantry'
  | 'sleep'
  | BotId;

interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'overview', label: 'Office Overview', position: [0, 14.2, 22.0], target: [0, 1.0, 0.2] },
  { id: 'reception', label: 'Reception', position: [-6.5, 4.4, 12.6], target: [-10.8, 1.1, 6.2] },
  { id: 'ceo', label: 'CEO Office', position: [-9.2, 5.4, -0.8], target: [-7.2, 1.1, -6.2] },
  { id: 'meeting', label: 'Meeting Room', position: [9.4, 5.4, -0.8], target: [7.2, 1.1, -6.2] },
  { id: 'billiard', label: 'Billiard', position: [14.0, 5.0, 11.4], target: [10.8, 0.9, 6.2] },
  { id: 'pantry', label: 'Pantry & Coffee', position: [7.8, 4.2, 2.0], target: [12.8, 1.1, -2.0] },
  { id: 'sleep', label: 'Quiet Lounge', position: [-7.8, 4.4, 2.2], target: [-12.8, 0.9, -1.6] },
  { id: 'alex', label: 'Alex', position: [0, 3.4, 7.6], target: [0, 1.2, 3.2] },
  { id: 'emma', label: 'Emma', position: [-6.2, 3.6, 5.8], target: [-5.4, 1.2, 1.8] },
  { id: 'max', label: 'Max', position: [-6.4, 3.6, 1.4], target: [-5.4, 1.2, -1.8] },
  { id: 'sophie', label: 'Sophie', position: [6.2, 3.6, 5.8], target: [5.4, 1.2, 1.8] },
  { id: 'charlie', label: 'Charlie', position: [6.4, 3.6, 1.4], target: [5.4, 1.2, -1.8] },
];

interface WorkstationLayout {
  botId: BotId;
  x: number;
  z: number;
  rotY: number;
}

const WORKSTATIONS: WorkstationLayout[] = [
  { botId: 'alex', x: 0, z: 3.2, rotY: 0 },
  { botId: 'emma', x: -5.4, z: 1.8, rotY: 0.3 },
  { botId: 'max', x: -5.4, z: -1.8, rotY: 0.35 },
  { botId: 'sophie', x: 5.4, z: 1.8, rotY: -0.3 },
  { botId: 'charlie', x: 5.4, z: -1.8, rotY: -0.35 },
];

interface CuteRobotRig3D {
  botId: BotId;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  visorTexture: THREE.CanvasTexture;
  visorCanvas: HTMLCanvasElement;
  coreMat: THREE.MeshStandardMaterial;
  screenTexture: THREE.CanvasTexture;
  screenCanvas: HTMLCanvasElement;
  nameplateTexture: THREE.CanvasTexture;
  nameplateCanvas: HTMLCanvasElement;
  lastDrawnKey: string;
}

const STATUS_LABELS: Record<BotStatus, string> = {
  idle: 'IDLE · READY',
  thinking: 'THINKING',
  working: 'WORKING',
  completed: 'COMPLETED',
  error: 'ALERT · ERROR',
  waiting: 'AWAITING APPROVAL',
  paused: 'PAUSED',
};

const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();

function createOakFloorTextures(): { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#c9ab85';
  ctx.fillRect(0, 0, 512, 512);

  const plankH = 64;
  const tones = ['#cfb28d', '#c5a57d', '#bc9a70', '#d4b894', '#c1a076'];
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    const offset = (row % 2) * 128;
    for (let col = -1; col < 3; col++) {
      const x = col * 256 + offset;
      ctx.fillStyle = tones[(row * 3 + col + 4) % tones.length];
      ctx.fillRect(x, y, 256, plankH);

      // Subtle wood grain lines
      ctx.strokeStyle = 'rgba(105, 74, 42, 0.13)';
      ctx.lineWidth = 1.2;
      for (let g = 8; g < plankH; g += 10) {
        ctx.beginPath();
        ctx.moveTo(x, y + g);
        ctx.bezierCurveTo(
          x + 85,
          y + g + ((row + col) % 2 === 0 ? 3 : -3),
          x + 170,
          y + g - 2,
          x + 256,
          y + g
        );
        ctx.stroke();
      }

      // Plank seams
      ctx.strokeStyle = 'rgba(92, 65, 38, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 256, plankH);
    }
  }

  const colorMap = new THREE.CanvasTexture(c);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(6, 4.5);

  const b = document.createElement('canvas');
  b.width = 512;
  b.height = 512;
  const bCtx = b.getContext('2d')!;
  bCtx.fillStyle = '#909090';
  bCtx.fillRect(0, 0, 512, 512);
  bCtx.strokeStyle = '#555555';
  bCtx.lineWidth = 2;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    const offset = (row % 2) * 128;
    for (let col = -1; col < 3; col++) {
      const x = col * 256 + offset;
      bCtx.strokeRect(x, y, 256, plankH);
    }
  }
  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 4.5);

  return { colorMap, bumpMap };
}

function createCarpetTexture(baseHex: string, weaveHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = weaveHex;
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 8) {
      if ((x + y) % 16 === 0) {
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function createDaylightBackdropTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const ctx = c.getContext('2d')!;

  // Soft natural daylight sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, 240);
  sky.addColorStop(0, '#bfdbfe');
  sky.addColorStop(0.55, '#e0f2fe');
  sky.addColorStop(1, '#f8fafc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 320);

  // Subtle sunlit clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  const clouds = [
    [160, 72, 110, 24],
    [480, 56, 150, 28],
    [820, 82, 120, 22],
  ];
  clouds.forEach(([cx, cy, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soft distant modern office park skyline silhouettes
  const buildings = [
    [30, 150, 75, 170, '#cbd5e1'],
    [120, 120, 90, 200, '#dbeafe'],
    [230, 160, 80, 160, '#cbd5e1'],
    [340, 135, 95, 185, '#e2e8f0'],
    [470, 145, 85, 175, '#cbd5e1'],
    [590, 118, 105, 202, '#dbeafe'],
    [720, 152, 85, 168, '#e2e8f0'],
    [835, 130, 95, 190, '#cbd5e1'],
    [945, 160, 70, 160, '#dbeafe'],
  ] as const;
  buildings.forEach(([bx, by, bw, bh, col]) => {
    ctx.fillStyle = col;
    ctx.fillRect(bx, by, bw, bh);
  });

  // Soft courtyard tree canopy band outside the window sill
  ctx.fillStyle = '#86efac';
  for (let tx = 0; tx <= 1040; tx += 52) {
    ctx.beginPath();
    ctx.arc(tx, 295, 38 + (tx % 15), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4ade80';
  for (let tx = 26; tx <= 1040; tx += 68) {
    ctx.beginPath();
    ctx.arc(tx, 305, 32, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawCuteVisorCanvas(
  canvas: HTMLCanvasElement,
  emp: EmployeeProfile,
  texture: THREE.CanvasTexture
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 8, w * 0.5, h * 0.5, w * 0.58);
  if (emp.status === 'error') {
    grad.addColorStop(0, '#3a0a1e');
    grad.addColorStop(1, '#080416');
  } else {
    grad.addColorStop(0, '#0f3699');
    grad.addColorStop(0.65, '#07174d');
    grad.addColorStop(1, '#040928');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const glow =
    emp.status === 'error'
      ? '#ff4d6d'
      : emp.status === 'completed'
        ? '#22e58a'
        : emp.status === 'waiting'
          ? '#fbbf24'
          : emp.status === 'paused'
            ? '#64748b'
            : emp.id === 'max'
              ? '#00e5ff'
              : emp.colorHex;

  ctx.strokeStyle = glow;
  ctx.fillStyle = glow;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12;
  ctx.lineCap = 'round';
  ctx.lineWidth = 14;

  if (emp.status === 'error') {
    ctx.beginPath();
    ctx.moveTo(64, 54);
    ctx.lineTo(96, 86);
    ctx.moveTo(96, 54);
    ctx.lineTo(64, 86);
    ctx.moveTo(160, 54);
    ctx.lineTo(192, 86);
    ctx.moveTo(192, 54);
    ctx.lineTo(160, 86);
    ctx.stroke();
  } else if (emp.status === 'paused') {
    ctx.beginPath();
    ctx.moveTo(58, 70);
    ctx.lineTo(100, 70);
    ctx.moveTo(156, 70);
    ctx.lineTo(198, 70);
    ctx.stroke();
  } else if (emp.status === 'working') {
    ctx.beginPath();
    ctx.roundRect(62, 46, 36, 46, 18);
    ctx.roundRect(158, 46, 36, 46, 18);
    ctx.fill();
  } else {
    if (emp.id === 'sophie') {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.beginPath();
      ctx.ellipse(54, 96, 18, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(202, 96, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (emp.id === 'max') {
      ctx.beginPath();
      ctx.arc(80, 76, 20, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(176, 68, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(176, 68, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (emp.id === 'charlie') {
      ctx.beginPath();
      ctx.arc(80, 75, 20, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(176, 68, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(128, 88, 16, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(80, 76, 20, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(176, 76, 20, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      if (emp.id === 'emma') {
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(57, 65);
        ctx.lineTo(49, 57);
        ctx.moveTo(199, 65);
        ctx.lineTo(207, 57);
        ctx.stroke();
      } else if (emp.id === 'alex') {
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(128, 86, 12, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    }
  }

  ctx.shadowBlur = 0;
  texture.needsUpdate = true;
}

function drawMonitorCanvas(
  canvas: HTMLCanvasElement,
  emp: EmployeeProfile,
  texture: THREE.CanvasTexture
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clean light-mode corporate productivity monitor UI
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, canvas.width, 28);
  ctx.fillStyle = emp.colorHex;
  ctx.fillRect(0, 0, 8, 28);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`${emp.name} · ${emp.title}`, 16, 19);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`STATUS: ${STATUS_LABELS[emp.status]}`, 14, 48);

  // Clean document/spreadsheet rows on desktop screen
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(14, 64 + i * 24, canvas.width - 28, 15);
    ctx.fillStyle = i === 0 ? '#60a5fa' : '#cbd5e1';
    const w = emp.status === 'paused' ? 36 : 88 + ((i * 53 + emp.tasksCompleted * 17) % 130);
    ctx.fillRect(14, 64 + i * 24, Math.min(w, canvas.width - 28), 15);
  }

  ctx.fillStyle = '#1e293b';
  ctx.font = '12px sans-serif';
  const taskLine = emp.currentTaskTitle || 'Ready for daily assignments';
  ctx.fillText(taskLine.slice(0, 34), 14, 178);

  texture.needsUpdate = true;
}

function drawNameplateCanvas(
  canvas: HTMLCanvasElement,
  emp: EmployeeProfile,
  texture: THREE.CanvasTexture
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clean architectural white & soft-blue corporate desk plaque
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = emp.colorHex;
  ctx.fillRect(0, 0, 12, canvas.height);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(emp.name, 26, 38);

  ctx.fillStyle = emp.colorHex;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(emp.personality.archetype, 26, 61);

  ctx.fillStyle = '#64748b';
  ctx.font = '13px sans-serif';
  ctx.fillText(emp.title, 26, 82);

  ctx.fillStyle =
    emp.status === 'error' ? '#dc2626' : emp.status === 'waiting' ? '#d97706' : '#2563eb';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(STATUS_LABELS[emp.status], 26, 105);

  texture.needsUpdate = true;
}

function drawOfficeWallBoardCanvas(
  canvas: HTMLCanvasElement,
  employees: EmployeeProfile[],
  metrics: OfficeMetrics,
  texture: THREE.CanvasTexture
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clean white architectural wall display
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, canvas.width, 56);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('ROBOT OFFICE · DAILY TEAM OVERVIEW', 24, 37);

  const kpis = [
    ['TOTAL TASKS', String(metrics.totalTasks), '#334155'],
    ['ACTIVE', String(metrics.activeTasks), '#2563eb'],
    ['COMPLETED', String(metrics.completedTasks), '#16a34a'],
    ['APPROVALS', String(metrics.pendingApprovals), '#d97706'],
  ];
  kpis.forEach(([label, val, col], idx) => {
    const bx = 24 + idx * 148;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bx, 72, 136, 64);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, 72, 136, 64);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(label, bx + 12, 92);
    ctx.fillStyle = col;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(val, bx + 12, 124);
  });

  employees.forEach((emp, idx) => {
    const ry = 154 + idx * 42;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(24, ry, canvas.width - 48, 34);
    ctx.fillStyle = emp.colorHex;
    ctx.fillRect(24, ry, 7, 34);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${emp.name} — ${emp.title}`, 44, ry + 22);

    ctx.fillStyle = emp.enabled ? '#2563eb' : '#94a3b8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(STATUS_LABELS[emp.status], 430, ry + 22);
  });

  texture.needsUpdate = true;
}

function drawSignageCanvas(text: string, subtext: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 120);
  ctx.fillStyle = '#5b8ec9';
  ctx.fillRect(16, 22, 10, 84);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(text, 44, 60);
  ctx.fillStyle = '#64748b';
  ctx.font = '20px sans-serif';
  ctx.fillText(subtext, 44, 94);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function OfficeScene3D({
  employees,
  metrics,
  theme,
  selectedBotId,
  onSelectBot,
}: OfficeScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const employeesRef = useRef(employees);
  const metricsRef = useRef(metrics);
  const themeRef = useRef(theme);
  const onSelectBotRef = useRef(onSelectBot);
  const cameraCommandRef = useRef<CameraPresetId | null>(null);

  const [hoveredBot, setHoveredBot] = useState<{
    botId: BotId;
    x: number;
    y: number;
  } | null>(null);
  const [activePreset, setActivePreset] = useState<CameraPresetId>('overview');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  employeesRef.current = employees;
  metricsRef.current = metrics;
  themeRef.current = theme;
  onSelectBotRef.current = onSelectBot;

  const prevSelectedRef = useRef<BotId | null>(selectedBotId);

  useEffect(() => {
    if (selectedBotId) {
      cameraCommandRef.current = selectedBotId;
      setActivePreset(selectedBotId);
    } else if (prevSelectedRef.current !== null) {
      cameraCommandRef.current = 'overview';
      setActivePreset('overview');
    }
    prevSelectedRef.current = selectedBotId;
  }, [selectedBotId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        preserveDrawingBuffer: isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('3D viewport requires WebGL acceleration.');
      return;
    }

    const width = container.clientWidth || 1200;
    const height = container.clientHeight || 580;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL context lost. Attempting recovery...');
    };
    const onContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const initialBg = themeRef.current === 'dark' ? 0x1e293b : 0xe8edf3;
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.FogExp2(initialBg, 0.008);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 140);
    camera.position.set(0, 14.2, 22.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0.2);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 36;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.update();

    let activeTransition = false;
    const onControlStart = () => {
      activeTransition = false;
      cameraCommandRef.current = null;
    };
    controls.addEventListener('start', onControlStart);

    // --- REALISTIC NATURAL DAYLIGHT + SOFT OFFICE LIGHTING ---
    const hemiLight = new THREE.HemisphereLight(0xf0f6ff, 0xb8aa98, 0.72);
    scene.add(hemiLight);

    // Warm sunlight streaming through the large rear windows
    const sunLight = new THREE.DirectionalLight(0xfff2e0, 1.38);
    sunLight.position.set(-8, 13, -14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 52;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    // Soft interior bounce fill from front-right
    const interiorFill = new THREE.DirectionalLight(0xeef4fa, 0.48);
    interiorFill.position.set(10, 11, 14);
    scene.add(interiorFill);

    // --- SHARED PHOTOREALISTIC CORPORATE MATERIALS ---
    const { colorMap: oakColor, bumpMap: oakBump } = createOakFloorTextures();
    oakColor.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const grayCarpetTex = createCarpetTexture('#c5cbd4', '#b8bfc9');
    const creamCarpetTex = createCarpetTexture('#dfd6c7', '#d4cab9');
    const daylightBackdropTex = createDaylightBackdropTexture();
    const receptionSignTex = drawSignageCanvas('ROBOT OFFICE', 'RECEPTION & VISITOR LOUNGE');

    const whiteWallMat = new THREE.MeshStandardMaterial({
      color: 0xf1f4f8,
      roughness: 0.9,
      metalness: 0.02,
    });
    const lightGrayMat = new THREE.MeshStandardMaterial({
      color: 0xd6dde6,
      roughness: 0.74,
      metalness: 0.08,
    });
    const oakWoodMat = new THREE.MeshStandardMaterial({
      color: 0xc29868,
      roughness: 0.52,
      metalness: 0.04,
    });
    const walnutWoodMat = new THREE.MeshStandardMaterial({
      color: 0x734b30,
      roughness: 0.45,
      metalness: 0.06,
    });
    const creamFabricMat = new THREE.MeshStandardMaterial({
      color: 0xe3d9c8,
      roughness: 0.86,
      metalness: 0.02,
    });
    const beigeAccentMat = new THREE.MeshStandardMaterial({
      color: 0xd1c2ac,
      roughness: 0.78,
      metalness: 0.03,
    });
    const softBlueMat = new THREE.MeshStandardMaterial({
      color: 0x4c7eb8,
      roughness: 0.66,
      metalness: 0.06,
    });
    const charcoalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.25,
    });
    const architecturalFrameMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.34,
      metalness: 0.72,
    });
    const brushedMetalMat = new THREE.MeshStandardMaterial({
      color: 0xb8c4d1,
      roughness: 0.3,
      metalness: 0.8,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f2fa,
      transparent: true,
      opacity: 0.22,
      roughness: 0.06,
      metalness: 0.05,
      depthWrite: false,
    });
    const grayCarpetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: grayCarpetTex,
      roughness: 0.92,
      metalness: 0.0,
    });
    const creamCarpetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: creamCarpetTex,
      roughness: 0.92,
      metalness: 0.0,
    });
    const ceramicWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.32,
      metalness: 0.04,
    });
    const terracottaMat = new THREE.MeshStandardMaterial({
      color: 0xc68b67,
      roughness: 0.68,
      metalness: 0.04,
    });
    const contactShadowGeo = new THREE.CircleGeometry(1.25, 24);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });

    // --- FLOOR & OPEN-PLAN CARPET ZONE ---
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 23),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: oakColor,
        bumpMap: oakBump,
        bumpScale: 0.015,
        roughness: 0.55,
        metalness: 0.04,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Light gray acoustic office carpet pad under the 5 open-plan workstations
    const openPlanCarpet = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.02, 8.8),
      grayCarpetMat
    );
    openPlanCarpet.position.set(0, 0.01, 0.7);
    openPlanCarpet.receiveShadow = true;
    scene.add(openPlanCarpet);

    // --- ARCHITECTURAL BACK WALL WITH LARGE NATURAL DAYLIGHT WINDOWS ---
    const backWallZ = -10.5;
    // Lower continuous sill wall
    const backSillWall = new THREE.Mesh(new THREE.BoxGeometry(36, 0.85, 0.35), whiteWallMat);
    backSillWall.position.set(0, 0.425, backWallZ);
    backSillWall.receiveShadow = true;
    scene.add(backSillWall);

    // Oak baseboard & window sill ledge
    const backBaseboard = new THREE.Mesh(new THREE.BoxGeometry(36, 0.14, 0.4), oakWoodMat);
    backBaseboard.position.set(0, 0.07, backWallZ);
    const windowSillLedge = new THREE.Mesh(new THREE.BoxGeometry(35.8, 0.08, 0.46), oakWoodMat);
    windowSillLedge.position.set(0, 0.86, backWallZ + 0.03);
    scene.add(backBaseboard, windowSillLedge);

    // Top transom wall beam
    const backHeaderBeam = new THREE.Mesh(new THREE.BoxGeometry(36, 0.65, 0.35), whiteWallMat);
    backHeaderBeam.position.set(0, 4.42, backWallZ);
    backHeaderBeam.castShadow = true;
    backHeaderBeam.receiveShadow = true;
    scene.add(backHeaderBeam);

    // Structural white wall piers (creating 3 large daylight window bays)
    const pierConfigs: Array<[number, number]> = [
      [-17.2, 1.6],
      [-10.6, 1.3],
      [-3.5, 1.2],
      [3.5, 1.2],
      [10.6, 1.3],
      [17.2, 1.6],
    ];
    pierConfigs.forEach(([px, pw]) => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(pw, 3.3, 0.36), whiteWallMat);
      pier.position.set(px, 2.48, backWallZ);
      pier.castShadow = true;
      pier.receiveShadow = true;
      scene.add(pier);
    });

    // Large glass window panes & aluminum mullions in the 3 bays
    const windowBays: Array<[number, number]> = [
      [-7.05, 5.8],
      [0, 5.8],
      [7.05, 5.8],
      [-13.9, 5.2],
      [13.9, 5.2],
    ];
    windowBays.forEach(([wx, ww]) => {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(ww, 3.22, 0.05), glassMat);
      pane.position.set(wx, 2.5, backWallZ);
      scene.add(pane);

      // Clean architectural window frame mullions (slim slate-aluminum framing)
      const mullionCenter = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.24, 0.16), architecturalFrameMat);
      mullionCenter.position.set(wx, 2.5, backWallZ);
      mullionCenter.castShadow = true;
      const mullionTop = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.09, 0.18), architecturalFrameMat);
      mullionTop.position.set(wx, 4.08, backWallZ);
      const mullionBot = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.09, 0.18), architecturalFrameMat);
      mullionBot.position.set(wx, 0.92, backWallZ);
      scene.add(mullionCenter, mullionTop, mullionBot);
    });

    // Daylight outdoor sky & courtyard greenery backdrop outside the windows
    const outdoorBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 14),
      new THREE.MeshBasicMaterial({ map: daylightBackdropTex })
    );
    outdoorBackdrop.position.set(0, 4.2, -14.2);
    scene.add(outdoorBackdrop);

    // --- CLEAN ARCHITECTURAL OFFICE OPERATIONS DISPLAY (CENTER-FRONT CREDENZA OR WALL) ---
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 640;
    boardCanvas.height = 380;
    const boardTexture = new THREE.CanvasTexture(boardCanvas);
    boardTexture.colorSpace = THREE.SRGBColorSpace;
    boardTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    drawOfficeWallBoardCanvas(boardCanvas, employeesRef.current, metricsRef.current, boardTexture);

    // Mounted on a low architectural oak & aluminum freestanding display credenza at back center
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 1.55, -8.8);
    const credenzaBase = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.72, 0.65), lightGrayMat);
    credenzaBase.position.y = -1.18;
    credenzaBase.castShadow = true;
    credenzaBase.receiveShadow = true;
    const credenzaTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.06, 0.7), oakWoodMat);
    credenzaTop.position.y = -0.8;
    const boardFrame = new THREE.Mesh(
      new THREE.BoxGeometry(4.05, 2.35, 0.09),
      brushedMetalMat
    );
    boardFrame.position.y = 0.72;
    boardFrame.castShadow = true;
    const boardScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.85, 2.16),
      new THREE.MeshBasicMaterial({ map: boardTexture })
    );
    boardScreen.position.set(0, 0.72, 0.052);
    boardGroup.add(credenzaBase, credenzaTop, boardFrame, boardScreen);
    scene.add(boardGroup);

    // --- HELPER: REALISTIC STORAGE CABINET & BOOKSHELF ---
    const createBookshelf = (x: number, z: number, rotY = 0) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = rotY;

      const backPanel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.15, 0.05), oakWoodMat);
      backPanel.position.set(0, 1.08, -0.18);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.15, 0.42), oakWoodMat);
      sideL.position.set(-0.82, 1.08, 0);
      const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.15, 0.42), oakWoodMat);
      sideR.position.set(0.82, 1.08, 0);
      group.add(backPanel, sideL, sideR);

      // Lower closed storage cabinet doors
      const lowerCab = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.66, 0.36), lightGrayMat);
      lowerCab.position.set(0, 0.35, 0);
      lowerCab.castShadow = true;
      lowerCab.receiveShadow = true;
      group.add(lowerCab);

      [0.7, 1.18, 1.66, 2.12].forEach((sy) => {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.05, 0.4), oakWoodMat);
        shelf.position.set(0, sy, 0);
        shelf.castShadow = true;
        group.add(shelf);
      });

      const bookPalette = [0x5b8ec9, 0x334155, 0xd6c7b2, 0x64748b, 0x93c5fd, 0x78716c];
      [0.86, 1.34, 1.82].forEach((by, rowIdx) => {
        for (let b = 0; b < 6; b++) {
          const bh = 0.24 + ((b + rowIdx) % 3) * 0.035;
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, bh, 0.24),
            new THREE.MeshStandardMaterial({
              color: bookPalette[(b + rowIdx * 2) % bookPalette.length],
              roughness: 0.72,
            })
          );
          book.position.set(-0.56 + b * 0.12 + (rowIdx % 2) * 0.25, by + bh * 0.5 - 0.14, 0.02);
          book.castShadow = true;
          group.add(book);
        }
        // Cream storage organizer box on shelf
        const binderBox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.28), creamFabricMat);
        binderBox.position.set(rowIdx % 2 === 0 ? 0.48 : -0.52, by - 0.02, 0.02);
        group.add(binderBox);
      });

      scene.add(group);
    };

    const createStorageCredenza = (x: number, z: number, rotY = 0) => {
      const cab = new THREE.Group();
      cab.position.set(x, 0, z);
      cab.rotation.y = rotY;
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.54), lightGrayMat);
      body.position.y = 0.44;
      body.castShadow = true;
      body.receiveShadow = true;
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.06, 0.58), oakWoodMat);
      top.position.y = 0.89;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.72, 0.03), charcoalMat);
      seam.position.set(0, 0.44, 0.27);
      const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), brushedMetalMat);
      handleL.position.set(-0.12, 0.52, 0.28);
      const handleR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), brushedMetalMat);
      handleR.position.set(0.12, 0.52, 0.28);
      cab.add(body, top, seam, handleL, handleR);
      scene.add(cab);
    };

    // Place storage cabinets and bookshelves cleanly along open-plan piers & side zones
    createBookshelf(-3.45, -9.8, 0);
    createBookshelf(3.45, -9.8, 0);
    createStorageCredenza(-10.8, -9.8, 0);
    createStorageCredenza(10.8, -9.8, 0);

    // --- HELPER: MULTI-PART ERGONOMIC OFFICE CHAIR ---
    const createErgonomicChair = (
      seatMat: THREE.Material,
      x: number,
      z: number,
      rotY: number
    ) => {
      const chair = new THREE.Group();
      chair.position.set(x, 0, z);
      chair.rotation.y = rotY;

      // 5-star caster base
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.3), brushedMetalMat);
        spoke.position.set(Math.sin(ang) * 0.14, 0.07, Math.cos(ang) * 0.14);
        spoke.rotation.y = ang;
        chair.add(spoke);

        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 8), charcoalMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(Math.sin(ang) * 0.27, 0.032, Math.cos(ang) * 0.27);
        chair.add(wheel);
      }

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.36, 10), charcoalMat);
      stem.position.y = 0.26;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.52), seatMat);
      seat.position.y = 0.47;
      seat.castShadow = true;

      const backSupport = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.05), charcoalMat);
      backSupport.position.set(0, 0.62, 0.25);

      const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.07), seatMat);
      backrest.position.set(0, 0.84, 0.24);
      backrest.rotation.x = 0.08;
      backrest.castShadow = true;

      // Ergonomic armrests
      [-0.29, 0.29].forEach((ax) => {
        const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.05), charcoalMat);
        armPost.position.set(ax, 0.57, 0.02);
        const armPad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.28), charcoalMat);
        armPad.position.set(ax, 0.69, 0.0);
        chair.add(armPost, armPad);
      });

      chair.add(stem, seat, backSupport, backrest);
      return chair;
    };

    // --- 1. MAIN CEO PRIVATE OFFICE (BACK-LEFT, GLASS PARTITIONED) ---
    const ceoOffice = new THREE.Group();
    ceoOffice.position.set(-7.2, 0, -6.2);

    const ceoRug = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.02, 5.8), creamCarpetMat);
    ceoRug.position.y = 0.015;
    ceoRug.receiveShadow = true;

    // Architectural slim slate-aluminum framed glass partitions (matching real corporate studio glass walls)
    const ceoGlassFront = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.1, 0.05), glassMat);
    ceoGlassFront.position.set(-1.1, 1.55, 2.95);
    const ceoFrameFrontBot = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.07, 0.11), architecturalFrameMat);
    ceoFrameFrontBot.position.set(-1.1, 0.035, 2.95);
    const ceoFrameFrontTop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.11), architecturalFrameMat);
    ceoFrameFrontTop.position.set(-1.1, 3.1, 2.95);
    const ceoDoorPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.12, 0.11), architecturalFrameMat);
    ceoDoorPost.position.set(1.1, 1.56, 2.95);

    const ceoGlassSide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.1, 5.9), glassMat);
    ceoGlassSide.position.set(3.25, 1.55, 0);
    const ceoFrameSideBot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 5.9), architecturalFrameMat);
    ceoFrameSideBot.position.set(3.25, 0.035, 0);
    const ceoFrameSideTop = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 5.9), architecturalFrameMat);
    ceoFrameSideTop.position.set(3.25, 3.1, 0);
    const ceoCornerPost = new THREE.Mesh(new THREE.BoxGeometry(0.11, 3.12, 0.11), architecturalFrameMat);
    ceoCornerPost.position.set(3.25, 1.56, 2.95);

    // Larger Executive Natural Walnut/Oak Desk + Side Return
    const ceoDeskTop = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.09, 1.25), walnutWoodMat);
    ceoDeskTop.position.set(0, 0.78, -0.35);
    ceoDeskTop.castShadow = true;
    ceoDeskTop.receiveShadow = true;
    const ceoDeskReturn = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 1.45), walnutWoodMat);
    ceoDeskReturn.position.set(-1.15, 0.75, -1.55);
    ceoDeskReturn.castShadow = true;
    const ceoDeskPedestalL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.74, 1.05), creamFabricMat);
    ceoDeskPedestalL.position.set(-1.05, 0.37, -0.35);
    const ceoDeskPedestalR = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.74, 1.05), creamFabricMat);
    ceoDeskPedestalR.position.set(1.05, 0.37, -0.35);

    // Executive desktop monitor & leather blotter pad (no sci-fi globe)
    const ceoBlotter = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.015, 0.55), beigeAccentMat);
    ceoBlotter.position.set(0, 0.83, -0.15);
    const ceoMonitorBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.08), brushedMetalMat);
    ceoMonitorBase.position.set(0, 0.96, -0.7);
    const ceoMonitor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 0.05), charcoalMat);
    ceoMonitor.position.set(0, 1.24, -0.66);
    ceoMonitor.castShadow = true;
    const ceoCoffeeMug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.11, 12), ceramicWhiteMat);
    ceoCoffeeMug.position.set(0.76, 0.88, -0.2);

    // Executive high-back ergonomic leather chair + 2 cream visitor chairs
    const ceoExecChair = createErgonomicChair(beigeAccentMat, 0, -1.45, Math.PI);
    const ceoVisitorChairL = createErgonomicChair(softBlueMat, -0.85, 0.9, 0.18);
    const ceoVisitorChairR = createErgonomicChair(softBlueMat, 0.85, 0.9, -0.18);

    ceoOffice.add(
      ceoRug,
      ceoGlassFront,
      ceoFrameFrontBot,
      ceoFrameFrontTop,
      ceoDoorPost,
      ceoGlassSide,
      ceoFrameSideBot,
      ceoFrameSideTop,
      ceoCornerPost,
      ceoDeskTop,
      ceoDeskReturn,
      ceoDeskPedestalL,
      ceoDeskPedestalR,
      ceoBlotter,
      ceoMonitorBase,
      ceoMonitor,
      ceoCoffeeMug,
      ceoExecChair,
      ceoVisitorChairL,
      ceoVisitorChairR
    );
    scene.add(ceoOffice);

    // --- 2. SMALL CONFERENCE & MEETING ROOM (BACK-RIGHT, GLASS PARTITIONED) ---
    const meetingRoom = new THREE.Group();
    meetingRoom.position.set(7.2, 0, -6.2);

    const meetRug = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.02, 5.8), grayCarpetMat);
    meetRug.position.y = 0.015;
    meetRug.receiveShadow = true;

    const meetGlassFront = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.1, 0.05), glassMat);
    meetGlassFront.position.set(1.1, 1.55, 2.95);
    const meetFrameFrontBot = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.07, 0.11), architecturalFrameMat);
    meetFrameFrontBot.position.set(1.1, 0.035, 2.95);
    const meetFrameFrontTop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.11), architecturalFrameMat);
    meetFrameFrontTop.position.set(1.1, 3.1, 2.95);
    const meetDoorPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.12, 0.11), architecturalFrameMat);
    meetDoorPost.position.set(-1.1, 1.56, 2.95);

    const meetGlassSide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.1, 5.9), glassMat);
    meetGlassSide.position.set(-3.25, 1.55, 0);
    const meetFrameSideBot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 5.9), architecturalFrameMat);
    meetFrameSideBot.position.set(-3.25, 0.035, 0);
    const meetFrameSideTop = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 5.9), architecturalFrameMat);
    meetFrameSideTop.position.set(-3.25, 3.1, 0);
    const meetCornerPost = new THREE.Mesh(new THREE.BoxGeometry(0.11, 3.12, 0.11), architecturalFrameMat);
    meetCornerPost.position.set(-3.25, 1.56, 2.95);

    // Natural Oak Conference Table + Brushed Aluminum Legs
    const confTableTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.75), oakWoodMat);
    confTableTop.position.set(0, 0.76, 0);
    confTableTop.castShadow = true;
    confTableTop.receiveShadow = true;
    [
      [-1.35, -0.55],
      [1.35, -0.55],
      [-1.35, 0.55],
      [1.35, 0.55],
    ].forEach(([lx, lz]) => {
      const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.74, 10), brushedMetalMat);
      tLeg.position.set(lx, 0.37, lz);
      meetingRoom.add(tLeg);
    });

    // Subtle tabletop notepad & carafe
    const confPad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.24), ceramicWhiteMat);
    confPad.position.set(-0.5, 0.81, 0.15);

    meetingRoom.add(
      meetRug,
      meetGlassFront,
      meetFrameFrontBot,
      meetFrameFrontTop,
      meetDoorPost,
      meetGlassSide,
      meetFrameSideBot,
      meetFrameSideTop,
      meetCornerPost,
      confTableTop,
      confPad
    );

    // 6 Comfortable Soft-Blue Ergonomic Conference Chairs
    const confChairCoords: Array<[number, number, number]> = [
      [-1.0, -1.15, Math.PI],
      [0, -1.15, Math.PI],
      [1.0, -1.15, Math.PI],
      [-1.0, 1.15, 0],
      [0, 1.15, 0],
      [1.0, 1.15, 0],
    ];
    confChairCoords.forEach(([cx, cz, ry]) => {
      meetingRoom.add(createErgonomicChair(softBlueMat, cx, cz, ry));
    });
    scene.add(meetingRoom);

    // --- 3. RECEPTION AREA (FRONT-LEFT ENTRANCE ZONE) ---
    const receptionGroup = new THREE.Group();
    receptionGroup.position.set(-10.8, 0, 6.2);

    const recRug = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.02, 4.4), creamCarpetMat);
    recRug.position.y = 0.015;
    recRug.receiveShadow = true;

    // Clean Natural Oak & Matte White Reception Desk with dark slate plinth for grounded contact
    const recPlinth = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.08, 0.74), charcoalMat);
    recPlinth.position.set(0, 0.06, -0.5);
    const recBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 0.78), ceramicWhiteMat);
    recBase.position.set(0, 0.52, -0.5);
    recBase.castShadow = true;
    recBase.receiveShadow = true;
    const recWoodAccent = new THREE.Mesh(new THREE.BoxGeometry(2.84, 0.54, 0.06), oakWoodMat);
    recWoodAccent.position.set(0, 0.34, -0.1);
    const recCounterTop = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.07, 0.88), oakWoodMat);
    recCounterTop.position.set(0, 1.0, -0.5);
    recCounterTop.castShadow = true;

    const recSignPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.54),
      new THREE.MeshBasicMaterial({ map: receptionSignTex })
    );
    recSignPanel.position.set(0, 0.64, -0.06);

    const recCheckInScreen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.04), charcoalMat);
    recCheckInScreen.position.set(-0.55, 1.24, -0.58);
    recCheckInScreen.rotation.x = -0.12;

    // Warm Oatmeal-Beige Visitor Waiting Sofa with walnut legs + Low Oak Coffee Table
    const sofaSeat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 0.82), beigeAccentMat);
    sofaSeat.position.set(0, 0.29, 1.35);
    sofaSeat.castShadow = true;
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 0.18), beigeAccentMat);
    sofaBack.position.set(0, 0.58, 1.68);
    sofaBack.castShadow = true;
    const sofaArmL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.82), beigeAccentMat);
    sofaArmL.position.set(-0.98, 0.44, 1.35);
    const sofaArmR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.82), beigeAccentMat);
    sofaArmR.position.set(0.98, 0.44, 1.35);
    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.09, 0.7), walnutWoodMat);
    sofaBase.position.set(0, 0.1, 1.35);
    const sofaThrow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.14), softBlueMat);
    sofaThrow.position.set(-0.62, 0.54, 1.48);
    sofaThrow.rotation.z = 0.12;

    const recCoffeeTable = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.62), oakWoodMat);
    recCoffeeTable.position.set(0, 0.42, 0.52);
    recCoffeeTable.castShadow = true;
    const recTableLegL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.5), architecturalFrameMat);
    recTableLegL.position.set(-0.46, 0.21, 0.52);
    const recTableLegR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.5), architecturalFrameMat);
    recTableLegR.position.set(0.46, 0.21, 0.52);

    receptionGroup.add(
      recRug,
      recPlinth,
      recBase,
      recWoodAccent,
      recCounterTop,
      recSignPanel,
      recCheckInScreen,
      sofaBase,
      sofaSeat,
      sofaBack,
      sofaArmL,
      sofaArmR,
      sofaThrow,
      recCoffeeTable,
      recTableLegL,
      recTableLegR
    );
    scene.add(receptionGroup);

    // --- 4. QUIET REST / NAP NOOK (LEFT WING, RESTYLED IN SERENE WOOD & CREAM) ---
    const sleepQuarter = new THREE.Group();
    sleepQuarter.position.set(-12.8, 0, -1.6);

    const sleepRug = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.02, 7.2), creamCarpetMat);
    sleepRug.position.y = 0.015;
    sleepRug.receiveShadow = true;

    const sleepBackWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.8, 7.6), whiteWallMat);
    sleepBackWall.position.set(-2.92, 1.4, 0);
    sleepBackWall.receiveShadow = true;

    const sleepBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 7.6), oakWoodMat);
    sleepBaseboard.position.set(-2.9, 0.07, 0);

    // Framed minimalist architectural print on sleep lounge wall
    const sleepArtFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 1.35), walnutWoodMat);
    sleepArtFrame.position.set(-2.82, 1.75, 0);
    const sleepArtMat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 1.16), creamFabricMat);
    sleepArtMat.position.set(-2.815, 1.75, 0);
    const sleepArtCenter = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.44, 0.65), softBlueMat);
    sleepArtCenter.position.set(-2.81, 1.75, 0);

    const sleepGlassPartition = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 2.8), glassMat);
    sleepGlassPartition.position.set(2.85, 1.3, -2.2);

    sleepQuarter.add(sleepRug, sleepBackWall, sleepBaseboard, sleepArtFrame, sleepArtMat, sleepArtCenter, sleepGlassPartition);

    const blanketMats = [softBlueMat, beigeAccentMat];
    [-1.65, 1.55].forEach((bz, idx) => {
      const bed = new THREE.Group();
      bed.position.set(-1.1, 0.03, bz);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 1.5), oakWoodMat);
      frame.position.y = 0.15;
      frame.castShadow = true;
      frame.receiveShadow = true;

      const headboard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.88, 1.56), oakWoodMat);
      headboard.position.set(-1.22, 0.46, 0);
      headboard.castShadow = true;

      const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.18, 1.38), ceramicWhiteMat);
      mattress.position.set(0.03, 0.35, 0);
      mattress.castShadow = true;

      const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.2, 1.42), blanketMats[idx]);
      blanket.position.set(0.45, 0.36, 0);
      blanket.castShadow = true;

      const pillowA = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.54), creamFabricMat);
      pillowA.position.set(-0.88, 0.49, -0.32);
      pillowA.rotation.z = -0.12;
      const pillowB = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.54), creamFabricMat);
      pillowB.position.set(-0.88, 0.49, 0.32);
      pillowB.rotation.z = -0.12;

      bed.add(frame, headboard, mattress, blanket, pillowA, pillowB);
      sleepQuarter.add(bed);
    });

    const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.62), oakWoodMat);
    nightstand.position.set(-2.0, 0.28, -0.05);
    nightstand.castShadow = true;
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.08, 0.24, 12), brushedMetalMat);
    lampStem.position.set(-2.0, 0.65, -0.05);
    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.21, 0.24, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xfde68a,
        emissiveIntensity: 0.45,
        roughness: 0.6,
      })
    );
    lampShade.position.set(-2.0, 0.86, -0.05);
    sleepQuarter.add(nightstand, lampStem, lampShade);
    scene.add(sleepQuarter);

    // --- 5. PANTRY & COFFEE BAR (RIGHT WING, WARM WHITE, OAK & GRAY) ---
    const pantryGroup = new THREE.Group();
    pantryGroup.position.set(12.8, 0, -2.0);

    const pantryTilePad = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.02, 8.0), lightGrayMat);
    pantryTilePad.position.y = 0.015;
    pantryTilePad.receiveShadow = true;

    const pantryBackWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.9, 8.2), whiteWallMat);
    pantryBackWall.position.set(2.92, 1.45, 0);
    pantryBackWall.receiveShadow = true;

    const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 1.15), brushedMetalMat);
    fridgeBody.position.set(2.15, 1.17, -2.9);
    fridgeBody.castShadow = true;
    const fridgeSplit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.24, 0.03), charcoalMat);
    fridgeSplit.position.set(1.59, 1.17, -2.9);
    const fridgeHandleL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), charcoalMat);
    fridgeHandleL.position.set(1.56, 1.34, -3.05);
    const fridgeHandleR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), charcoalMat);
    fridgeHandleR.position.set(1.56, 1.34, -2.75);

    const counterBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 4.4), oakWoodMat);
    counterBase.position.set(2.15, 0.47, 0.25);
    counterBase.castShadow = true;
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 4.5), ceramicWhiteMat);
    counterTop.position.set(2.12, 0.96, 0.25);
    counterTop.castShadow = true;

    const sinkBasin = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.76), brushedMetalMat);
    sinkBasin.position.set(2.12, 1.01, -1.05);
    const faucetStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.34, 10), brushedMetalMat);
    faucetStem.position.set(2.42, 1.17, -1.05);
    const faucetSpout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), brushedMetalMat);
    faucetSpout.position.set(2.31, 1.33, -1.05);

    const pantryShelf = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 2.8), oakWoodMat);
    pantryShelf.position.set(2.6, 2.02, 0.3);
    [0xd6c7b2, 0x5b8ec9, 0x86efac].forEach((col, jIdx) => {
      const jar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.25, 14),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.08 })
      );
      jar.position.set(2.58, 2.18, -0.4 + jIdx * 0.55);
      pantryGroup.add(jar);
    });

    // Commercial Espresso Machine on Cream Counter
    const coffeeStation = new THREE.Group();
    coffeeStation.position.set(2.05, 1.0, 0.85);
    coffeeStation.rotation.y = -Math.PI / 2;

    const coffeeBody = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 0.52), charcoalMat);
    coffeeBody.position.set(0, 0.28, 0);
    coffeeBody.castShadow = true;
    const coffeeTopChrome = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.5), brushedMetalMat);
    coffeeTopChrome.position.set(0, 0.58, 0);
    const beanHopper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.11, 0.24, 16),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.25, metalness: 0.1 })
    );
    beanHopper.position.set(-0.14, 0.72, -0.02);
    const groupHead = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.16), brushedMetalMat);
    groupHead.position.set(0, 0.4, 0.28);
    const portafilterHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 10), walnutWoodMat);
    portafilterHandle.rotation.x = Math.PI / 2;
    portafilterHandle.position.set(-0.08, 0.33, 0.44);
    const dripTray = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.24), brushedMetalMat);
    dripTray.position.set(0, 0.03, 0.32);

    const espressoCup = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.12, 14), ceramicWhiteMat);
    espressoCup.position.set(0.02, 0.12, 0.33);
    const counterMug = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.15, 14), ceramicWhiteMat);
    counterMug.position.set(0.55, 0.08, 0.18);

    coffeeStation.add(
      coffeeBody,
      coffeeTopChrome,
      beanHopper,
      groupHead,
      portafilterHandle,
      dripTray,
      espressoCup,
      counterMug
    );

    const barTable = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 2.5), oakWoodMat);
    barTable.position.set(-1.05, 0.96, 0.55);
    barTable.castShadow = true;
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.92, 2.2), ceramicWhiteMat);
    barBase.position.set(-1.05, 0.47, 0.55);

    [-0.1, 1.2].forEach((sz) => {
      const stool = new THREE.Group();
      stool.position.set(-1.85, 0, sz);
      const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16), beigeAccentMat);
      stoolSeat.position.y = 0.68;
      const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.18, 0.66, 12), brushedMetalMat);
      stoolLeg.position.y = 0.34;
      stool.add(stoolSeat, stoolLeg);
      pantryGroup.add(stool);
    });

    pantryGroup.add(
      pantryTilePad,
      pantryBackWall,
      fridgeBody,
      fridgeSplit,
      fridgeHandleL,
      fridgeHandleR,
      counterBase,
      counterTop,
      sinkBasin,
      faucetStem,
      faucetSpout,
      pantryShelf,
      coffeeStation,
      barTable,
      barBase
    );
    scene.add(pantryGroup);

    // --- 6. BILLIARD BREAK LOUNGE (FRONT-RIGHT, NATURAL OAK & SOFT-BLUE/SAGE) ---
    const billiardGroup = new THREE.Group();
    billiardGroup.position.set(10.8, 0, 6.2);

    const billiardRug = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.02, 4.0), creamCarpetMat);
    billiardRug.position.y = 0.015;
    billiardRug.receiveShadow = true;

    const feltMat = new THREE.MeshStandardMaterial({ color: 0x3b7a6c, roughness: 0.85, metalness: 0.02 });
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

    [
      [-1.4, -0.75],
      [1.4, -0.75],
      [-1.4, 0.75],
      [1.4, 0.75],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.78, 12), walnutWoodMat);
      leg.position.set(lx, 0.39, lz);
      leg.castShadow = true;
      billiardGroup.add(leg);
    });

    const tableCabinet = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.24, 1.92), walnutWoodMat);
    tableCabinet.position.y = 0.84;
    tableCabinet.castShadow = true;

    const feltBed = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.05, 1.56), feltMat);
    feltBed.position.y = 0.96;
    feltBed.receiveShadow = true;

    const railLongN = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.1, 0.18), walnutWoodMat);
    railLongN.position.set(0, 1.0, -0.87);
    const railLongS = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.1, 0.18), walnutWoodMat);
    railLongS.position.set(0, 1.0, 0.87);
    const railShortW = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 1.92), walnutWoodMat);
    railShortW.position.set(-1.58, 1.0, 0);
    const railShortE = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 1.92), walnutWoodMat);
    railShortE.position.set(1.58, 1.0, 0);

    [
      [-1.44, -0.74],
      [0, -0.78],
      [1.44, -0.74],
      [-1.44, 0.74],
      [0, 0.78],
      [1.44, 0.74],
    ].forEach(([px, pz]) => {
      const pocket = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 14), pocketMat);
      pocket.position.set(px, 0.98, pz);
      billiardGroup.add(pocket);
    });

    const cueBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.05 })
    );
    cueBall.position.set(-0.78, 1.03, 0.04);

    const ballColors = [
      0xfacc15, 0xef4444, 0x3b82f6, 0xa855f7, 0x111827, 0xf97316, 0x22c55e, 0x991b1b, 0x06b6d4,
      0xec4899,
    ];
    let ballIdx = 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col <= row; col++) {
        const bx = 0.45 + row * 0.095;
        const bz = (col - row * 0.5) * 0.105;
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.046, 12, 12),
          new THREE.MeshStandardMaterial({
            color: ballColors[ballIdx % ballColors.length],
            roughness: 0.18,
            metalness: 0.08,
          })
        );
        ball.position.set(bx, 1.03, bz);
        billiardGroup.add(ball);
        ballIdx++;
      }
    }

    const cueMat = new THREE.MeshStandardMaterial({ color: 0xc2935e, roughness: 0.4, metalness: 0.08 });
    const cue1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.028, 2.35, 10), cueMat);
    cue1.rotation.z = Math.PI / 2;
    cue1.rotation.y = 0.08;
    cue1.position.set(-0.15, 1.07, 0.87);

    const cue2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.028, 2.35, 10), cueMat);
    cue2.rotation.z = Math.PI / 2;
    cue2.rotation.y = -0.06;
    cue2.position.set(0.12, 1.07, -0.87);

    billiardGroup.add(
      billiardRug,
      tableCabinet,
      feltBed,
      railLongN,
      railLongS,
      railShortW,
      railShortE,
      cueBall,
      cue1,
      cue2
    );
    scene.add(billiardGroup);

    // --- 7. INDOOR PLANTS (NATURAL CERAMIC & TERRACOTTA PLANTERS) ---
    const plantPositions: Array<[number, number, boolean]> = [
      [-13.8, 7.2, true],
      [-7.6, 5.4, false],
      [14.4, 3.0, true],
      [-3.2, -5.8, false],
      [3.2, -5.8, true],
      [-9.8, -9.2, false],
      [9.8, -9.2, true],
    ];
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d47, roughness: 0.68, metalness: 0.03 });
    const leafAltMat = new THREE.MeshStandardMaterial({ color: 0x45945d, roughness: 0.62, metalness: 0.03 });

    plantPositions.forEach(([px, pz, useTerracotta]) => {
      const plant = new THREE.Group();
      plant.position.set(px, 0, pz);
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.26, 0.62, 16),
        useTerracotta ? terracottaMat : ceramicWhiteMat
      );
      pot.position.y = 0.31;
      pot.castShadow = true;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.72, 8), walnutWoodMat);
      stem.position.y = 0.78;
      plant.add(pot, stem);

      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(
          new THREE.ConeGeometry(0.24, 0.74, 7),
          f % 2 === 0 ? leafMat : leafAltMat
        );
        const a = (f / 6) * Math.PI * 2;
        frond.position.set(Math.cos(a) * 0.25, 1.12 + (f % 2) * 0.14, Math.sin(a) * 0.25);
        frond.rotation.z = -Math.cos(a) * 0.48;
        frond.rotation.x = Math.sin(a) * 0.48;
        frond.castShadow = true;
        plant.add(frond);
      }
      scene.add(plant);
    });

    // --- 8. FIVE OPEN-PLAN EMPLOYEE WORKSTATIONS (OAK DESKS, DESKTOP PCs, ERGONOMIC CHAIRS & AI EMPLOYEES) ---
    const robotRigs = new Map<BotId, CuteRobotRig3D>();
    const hitboxes: THREE.Mesh[] = [];
    const hitboxGeo = new THREE.BoxGeometry(2.5, 2.3, 2.5);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });

    const whiteShellMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.08,
    });
    const navyOutlineMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.25,
    });

    WORKSTATIONS.forEach((ws) => {
      const emp = employeesRef.current.find((e) => e.id === ws.botId);
      if (!emp) return;

      const station = new THREE.Group();
      station.position.set(ws.x, 0, ws.z);
      station.rotation.y = ws.rotY;

      const shadowDisc = new THREE.Mesh(contactShadowGeo, contactShadowMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.022;
      station.add(shadowDisc);

      // Natural Oak Desk + Light-Gray Privacy Divider + Brushed Steel Legs
      const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.075, 1.08), oakWoodMat);
      deskTop.position.set(0, 0.76, -0.35);
      deskTop.castShadow = true;
      deskTop.receiveShadow = true;

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.88), brushedMetalMat);
      legL.position.set(-1.04, 0.37, -0.35);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.88), brushedMetalMat);
      legR.position.set(1.04, 0.37, -0.35);

      // Acoustic light-gray desk modesty/privacy screen along rear edge
      const deskDivider = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.36, 0.04), lightGrayMat);
      deskDivider.position.set(0, 0.96, -0.87);
      deskDivider.castShadow = true;

      // Under-desk cream/gray drawer pedestal on left side
      const deskDrawers = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.62, 0.76), ceramicWhiteMat);
      deskDrawers.position.set(-0.76, 0.32, -0.36);
      deskDrawers.castShadow = true;

      station.add(deskTop, legL, legR, deskDivider, deskDrawers);

      // Desktop Computer Tower on right side of desk
      const pcTower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.44), charcoalMat);
      pcTower.position.set(0.88, 1.03, -0.45);
      pcTower.castShadow = true;
      const pcFrontBezel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.02), brushedMetalMat);
      pcFrontBezel.position.set(0.88, 1.03, -0.225);
      station.add(pcTower, pcFrontBezel);

      // Beige desk mat + keyboard + mouse
      const deskMat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.01, 0.42), beigeAccentMat);
      deskMat.position.set(0.02, 0.802, -0.14);
      const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.19), ceramicWhiteMat);
      keyboard.position.set(-0.08, 0.815, -0.12);
      const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.13), charcoalMat);
      mouse.position.set(0.32, 0.815, -0.12);
      const deskMug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.1, 12), ceramicWhiteMat);
      deskMug.position.set(0.58, 0.845, -0.12);
      station.add(deskMat, keyboard, mouse, deskMug);

      // Personality Desk Prop (Realistic Corporate Materials)
      const propAccentMat = new THREE.MeshStandardMaterial({
        color: emp.colorHex,
        roughness: 0.4,
        metalness: 0.15,
      });
      if (ws.botId === 'alex') {
        const clipboard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.32), ceramicWhiteMat);
        clipboard.position.set(-0.74, 0.815, -0.15);
        clipboard.rotation.y = 0.2;
        const clip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.05), brushedMetalMat);
        clip.position.set(-0.74, 0.835, -0.28);
        station.add(clipboard, clip);
      } else if (ws.botId === 'emma') {
        const envelope = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.2), creamFabricMat);
        envelope.position.set(-0.75, 0.82, -0.15);
        envelope.rotation.y = -0.22;
        const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12), propAccentMat);
        seal.position.set(-0.75, 0.83, -0.15);
        station.add(envelope, seal);
      } else if (ws.botId === 'max') {
        const globeStand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.08, 12), brushedMetalMat);
        globeStand.position.set(-0.78, 0.84, -0.22);
        const miniGlobe = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 16, 14),
          softBlueMat
        );
        miniGlobe.position.set(-0.78, 0.98, -0.22);
        station.add(globeStand, miniGlobe);
      } else if (ws.botId === 'sophie') {
        const clockBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16), oakWoodMat);
        clockBase.rotation.x = Math.PI / 2;
        clockBase.position.set(-0.76, 0.92, -0.22);
        const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16), ceramicWhiteMat);
        clockFace.rotation.x = Math.PI / 2;
        clockFace.position.set(-0.76, 0.92, -0.22);
        station.add(clockBase, clockFace);
      } else {
        const sketchPad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.24), creamFabricMat);
        sketchPad.position.set(-0.74, 0.82, -0.16);
        sketchPad.rotation.y = 0.28;
        const penHolder = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 12), propAccentMat);
        penHolder.position.set(-0.92, 0.855, -0.42);
        station.add(sketchPad, penHolder);
      }

      // Widescreen Desktop Monitor (Crisp Light Office Display)
      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 320;
      screenCanvas.height = 200;
      const screenTexture = new THREE.CanvasTexture(screenCanvas);
      screenTexture.colorSpace = THREE.SRGBColorSpace;
      screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      drawMonitorCanvas(screenCanvas, emp, screenTexture);

      const monitorStand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.07), brushedMetalMat);
      monitorStand.position.set(0, 0.94, -0.66);
      const monitorBezel = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.68, 0.05), charcoalMat);
      monitorBezel.position.set(0, 1.22, -0.61);
      monitorBezel.castShadow = true;
      const monitorScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(1.06, 0.6),
        new THREE.MeshBasicMaterial({ map: screenTexture })
      );
      monitorScreen.position.set(0, 1.22, -0.58);
      station.add(monitorStand, monitorBezel, monitorScreen);

      // Ergonomic Office Chair behind desk
      const chair = createErgonomicChair(
        ws.botId === 'alex' ? softBlueMat : beigeAccentMat,
        0,
        0.58,
        0
      );
      station.add(chair);

      // Clean Corporate Desk Nameplate Stand on front-left corner of desk
      const nameplateCanvas = document.createElement('canvas');
      nameplateCanvas.width = 320;
      nameplateCanvas.height = 120;
      const nameplateTexture = new THREE.CanvasTexture(nameplateCanvas);
      nameplateTexture.colorSpace = THREE.SRGBColorSpace;
      nameplateTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      drawNameplateCanvas(nameplateCanvas, emp, nameplateTexture);

      const nameplateStand = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.44, 0.04), oakWoodMat);
      nameplateStand.position.set(-0.62, 1.72, -0.87);
      const nameplate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.12, 0.4),
        new THREE.MeshBasicMaterial({ map: nameplateTexture, side: THREE.DoubleSide })
      );
      nameplate.position.set(-0.62, 1.72, -0.845);
      station.add(nameplateStand, nameplate);

      // Cute Floating Pod Robot seated comfortably in the ergonomic chair
      const accentColor = new THREE.Color(emp.id === 'max' ? '#00B8FF' : emp.colorHex);
      const coreMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 0.42,
        roughness: 0.25,
        metalness: 0.2,
      });

      const robotRoot = new THREE.Group();
      robotRoot.position.set(0, 0.54, 0.48);

      const bodyGroup = new THREE.Group();

      const podBody = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 18), whiteShellMat);
      podBody.scale.set(1.0, 1.22, 0.88);
      podBody.position.y = 0.34;
      podBody.castShadow = true;

      const chestShield = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), coreMat);
      chestShield.scale.set(1.05, 0.92, 0.36);
      chestShield.position.set(0, 0.38, -0.2);

      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.84, 0);

      const headDome = new THREE.Mesh(new THREE.SphereGeometry(0.31, 26, 20), whiteShellMat);
      headDome.scale.set(1.22, 0.94, 0.94);
      headDome.castShadow = true;

      const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 16), whiteShellMat);
      topCap.position.y = 0.3;

      const earPodL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 16), whiteShellMat);
      earPodL.rotation.z = Math.PI / 2;
      earPodL.position.set(-0.39, -0.01, 0);

      const earPodR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 16), whiteShellMat);
      earPodR.rotation.z = Math.PI / 2;
      earPodR.position.set(0.39, -0.01, 0);

      const finHeight = ws.botId === 'max' ? 0.32 : 0.22;
      const finY = ws.botId === 'max' ? 0.22 : 0.18;
      const earFinL = new THREE.Mesh(new THREE.ConeGeometry(0.05, finHeight, 12), coreMat);
      earFinL.position.set(-0.38, finY, 0);
      earFinL.rotation.z = 0.1;

      const earFinR = new THREE.Mesh(new THREE.ConeGeometry(0.05, finHeight, 12), coreMat);
      earFinR.position.set(0.38, finY, 0);
      earFinR.rotation.z = -0.1;

      if (ws.botId === 'alex') {
        const crest = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.11, 4), coreMat);
        crest.position.set(0, 0.38, 0);
        const micBoom = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.025), navyOutlineMat);
        micBoom.position.set(-0.31, -0.11, -0.16);
        micBoom.rotation.y = 0.55;
        headGroup.add(crest, micBoom);
      } else if (ws.botId === 'emma') {
        const bowL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), coreMat);
        bowL.position.set(0.21, 0.3, -0.02);
        const bowR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), coreMat);
        bowR.position.set(0.29, 0.24, -0.02);
        headGroup.add(bowL, bowR);
      } else if (ws.botId === 'max') {
        const antMast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 8), navyOutlineMat);
        antMast.position.set(0, 0.4, 0);
        const antOrb = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), coreMat);
        antOrb.position.set(0, 0.49, 0);
        headGroup.add(antMast, antOrb);
      } else if (ws.botId === 'sophie') {
        const petalA = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), coreMat);
        petalA.position.set(-0.24, 0.28, -0.05);
        const petalB = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), coreMat);
        petalB.position.set(-0.18, 0.33, -0.05);
        const centerGem = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.3 })
        );
        centerGem.position.set(-0.21, 0.3, -0.07);
        headGroup.add(petalA, petalB, centerGem);
      } else {
        const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.085, 16), coreMat);
        beret.position.set(-0.04, 0.36, 0);
        beret.rotation.z = 0.22;
        headGroup.add(beret);
      }

      const visorCanvas = document.createElement('canvas');
      visorCanvas.width = 256;
      visorCanvas.height = 140;
      const visorTexture = new THREE.CanvasTexture(visorCanvas);
      visorTexture.colorSpace = THREE.SRGBColorSpace;
      visorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      drawCuteVisorCanvas(visorCanvas, emp, visorTexture);

      const visorBezel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.31, 0.06), navyOutlineMat);
      visorBezel.position.set(0, 0.0, -0.26);
      const visorFace = new THREE.Mesh(
        new THREE.PlaneGeometry(0.49, 0.25),
        new THREE.MeshBasicMaterial({ map: visorTexture })
      );
      visorFace.position.set(0, 0.0, -0.295);
      visorFace.rotation.y = Math.PI;

      headGroup.add(headDome, topCap, earPodL, earPodR, earFinL, earFinR, visorBezel, visorFace);

      const leftArm = new THREE.Group();
      leftArm.position.set(-0.3, 0.46, 0);
      const lArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.19, 8, 12), whiteShellMat);
      lArmMesh.position.set(-0.04, -0.12, -0.04);
      lArmMesh.rotation.z = -0.25;
      lArmMesh.rotation.x = 0.35;
      leftArm.add(lArmMesh);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.3, 0.46, 0);
      const rArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.19, 8, 12), whiteShellMat);
      rArmMesh.position.set(0.04, -0.12, -0.04);
      rArmMesh.rotation.z = 0.25;
      rArmMesh.rotation.x = 0.35;
      rightArm.add(rArmMesh);

      bodyGroup.add(podBody, chestShield, headGroup, leftArm, rightArm);
      robotRoot.add(bodyGroup);
      station.add(robotRoot);

      const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
      hitbox.position.set(0, 1.15, 0.1);
      hitbox.userData.botId = ws.botId;
      station.add(hitbox);
      hitboxes.push(hitbox);

      scene.add(station);

      robotRigs.set(ws.botId, {
        botId: ws.botId,
        root: robotRoot,
        bodyGroup,
        headGroup,
        leftArm,
        rightArm,
        visorTexture,
        visorCanvas,
        coreMat,
        screenTexture,
        screenCanvas,
        nameplateTexture,
        nameplateCanvas,
        lastDrawnKey: `${emp.status}:${emp.tasksCompleted}:${emp.currentTaskTitle ?? ''}`,
      });
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      return rect;
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (dist > 6) return;
      updatePointer(ev);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitboxes, false);
      if (hits.length > 0) {
        const botId = hits[0].object.userData.botId as BotId | undefined;
        if (botId) {
          onSelectBotRef.current(botId);
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 40) return;
      lastHoverTime = now;
      const rect = updatePointer(ev);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitboxes, false);
      if (hits.length > 0) {
        const botId = hits[0].object.userData.botId as BotId | undefined;
        if (botId) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredBot({
            botId,
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
          });
          return;
        }
      }
      renderer.domElement.style.cursor = 'grab';
      setHoveredBot(null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1200;
      const h = container.clientHeight || 580;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const startMs = performance.now();
    let lastFrameMs = startMs;
    let frameId = 0;
    let disposed = false;
    let lastBoardKey = '';

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.1);
      lastFrameMs = nowMs;
      const elapsed = (nowMs - startMs) / 1000;

      const targetBg = themeRef.current === 'dark' ? 0x1e293b : 0xe8edf3;
      if ((scene.background as THREE.Color).getHex() !== targetBg) {
        (scene.background as THREE.Color).setHex(targetBg);
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.setHex(targetBg);
        }
      }

      if (cameraCommandRef.current) {
        const preset = CAMERA_PRESETS.find((p) => p.id === cameraCommandRef.current);
        if (preset) {
          _camGoalPos.set(...preset.position);
          _camGoalTarget.set(...preset.target);
          activeTransition = true;
        }
        cameraCommandRef.current = null;
      }

      if (activeTransition) {
        const alpha = 1 - Math.exp(-6 * dt);
        camera.position.lerp(_camGoalPos, alpha);
        controls.target.lerp(_camGoalTarget, alpha);
        if (
          camera.position.distanceTo(_camGoalPos) < 0.05 &&
          controls.target.distanceTo(_camGoalTarget) < 0.05
        ) {
          camera.position.copy(_camGoalPos);
          controls.target.copy(_camGoalTarget);
          activeTransition = false;
        }
      }

      controls.update();

      const curMetrics = metricsRef.current;
      const curEmps = employeesRef.current;
      const boardKey = `${curMetrics.totalTasks}:${curMetrics.activeTasks}:${curMetrics.completedTasks}:${curMetrics.pendingApprovals}:${curEmps
        .map((e) => e.status)
        .join(',')}`;
      if (boardKey !== lastBoardKey) {
        lastBoardKey = boardKey;
        drawOfficeWallBoardCanvas(boardCanvas, curEmps, curMetrics, boardTexture);
      }

      curEmps.forEach((emp, idx) => {
        const rig = robotRigs.get(emp.id);
        if (!rig) return;

        const key = `${emp.status}:${emp.tasksCompleted}:${emp.currentTaskTitle ?? ''}`;
        if (key !== rig.lastDrawnKey) {
          rig.lastDrawnKey = key;
          drawCuteVisorCanvas(rig.visorCanvas, emp, rig.visorTexture);
          drawMonitorCanvas(rig.screenCanvas, emp, rig.screenTexture);
          drawNameplateCanvas(rig.nameplateCanvas, emp, rig.nameplateTexture);
        }

        const phase = elapsed + idx * 1.1;

        if (emp.status === 'working') {
          rig.bodyGroup.position.y = Math.sin(phase * 4) * 0.03;
          rig.bodyGroup.rotation.x = -0.08;
          rig.headGroup.rotation.set(-0.08, Math.sin(phase * 2) * 0.08, 0);
          rig.leftArm.rotation.x = Math.sin(phase * 14) * 0.25 - 0.15;
          rig.rightArm.rotation.x = Math.cos(phase * 14) * 0.25 - 0.15;
          rig.rightArm.rotation.z = 0;
          rig.coreMat.emissiveIntensity = 0.58;
        } else if (emp.status === 'thinking') {
          rig.bodyGroup.position.y = 0.04 + Math.sin(phase * 2) * 0.025;
          rig.bodyGroup.rotation.x = 0.04;
          rig.headGroup.rotation.set(0.08, Math.sin(phase * 1.3) * 0.22, 0.12);
          rig.leftArm.rotation.x = 0.1;
          rig.rightArm.rotation.x = -0.95;
          rig.rightArm.rotation.z = -0.25;
          rig.coreMat.emissiveIntensity = 0.52;
        } else if (emp.status === 'completed') {
          rig.bodyGroup.position.y = 0.06 + Math.abs(Math.sin(phase * 3)) * 0.06;
          rig.bodyGroup.rotation.x = 0;
          rig.headGroup.rotation.set(0, Math.sin(phase * 2.5) * 0.18, 0);
          rig.leftArm.rotation.x = -0.35;
          rig.rightArm.rotation.x = -0.9;
          rig.rightArm.rotation.z = -0.5 + Math.sin(phase * 6) * 0.22;
          rig.coreMat.emissiveIntensity = 0.65;
        } else if (emp.status === 'error') {
          rig.bodyGroup.position.y = 0.02;
          rig.bodyGroup.rotation.x = 0;
          rig.headGroup.rotation.set(0.08, Math.sin(phase * 12) * 0.22, 0);
          rig.leftArm.rotation.x = -0.4;
          rig.rightArm.rotation.x = -0.4;
          rig.rightArm.rotation.z = 0;
          rig.coreMat.emissiveIntensity = 0.35;
        } else if (emp.status === 'waiting') {
          rig.bodyGroup.position.y = 0.04 + Math.sin(phase * 2) * 0.025;
          rig.bodyGroup.rotation.x = 0;
          rig.headGroup.rotation.set(-0.04, Math.sin(phase * 0.9) * 0.15, 0);
          rig.leftArm.rotation.x = 0.15;
          rig.rightArm.rotation.x = -0.7;
          rig.rightArm.rotation.z = -0.45 + Math.sin(phase * 3) * 0.15;
          rig.coreMat.emissiveIntensity = 0.5;
        } else if (emp.status === 'paused') {
          rig.bodyGroup.position.y = -0.04;
          rig.bodyGroup.rotation.x = 0.15;
          rig.headGroup.rotation.set(0.28, 0, 0);
          rig.leftArm.rotation.x = 0.2;
          rig.rightArm.rotation.x = 0.2;
          rig.rightArm.rotation.z = 0;
          rig.coreMat.emissiveIntensity = 0.1;
        } else {
          const bounceSpeed = emp.id === 'charlie' ? 2.8 : emp.id === 'sophie' ? 1.3 : 1.8;
          const bounceAmp = emp.id === 'charlie' ? 0.045 : 0.028;
          rig.bodyGroup.position.y = 0.04 + Math.sin(phase * bounceSpeed) * bounceAmp;
          rig.bodyGroup.rotation.x = emp.id === 'emma' ? Math.sin(phase * 1.4) * 0.04 : 0;
          if (emp.id === 'max') {
            rig.headGroup.rotation.set(-0.04, Math.sin(phase * 1.9) * 0.28, 0.04);
          } else if (emp.id === 'charlie') {
            rig.headGroup.rotation.set(0, Math.sin(phase * 1.6) * 0.2, Math.sin(phase * 2.2) * 0.08);
          } else if (emp.id === 'sophie') {
            rig.headGroup.rotation.set(0, Math.sin(phase * 0.7) * 0.1, 0);
          } else {
            rig.headGroup.rotation.set(0, Math.sin(phase * 0.9) * 0.15, 0);
          }
          rig.leftArm.rotation.x = Math.sin(phase * 1.8) * 0.08;
          rig.rightArm.rotation.x = emp.id === 'alex' ? -0.45 : -0.58;
          rig.rightArm.rotation.z =
            emp.id === 'charlie'
              ? -0.5 + Math.sin(phase * 3.8) * 0.24
              : -0.38 + Math.sin(phase * 2.2) * 0.16;
          rig.coreMat.emissiveIntensity = 0.42;
        }
      });

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      oakColor.dispose();
      oakBump.dispose();
      grayCarpetTex.dispose();
      creamCarpetTex.dispose();
      daylightBackdropTex.dispose();
      receptionSignTex.dispose();
      boardTexture.dispose();
      robotRigs.forEach((rig) => {
        rig.visorTexture.dispose();
        rig.screenTexture.dispose();
        rig.nameplateTexture.dispose();
      });
      renderer.dispose();
    };
  }, []);

  const hoveredEmployee = hoveredBot
    ? employees.find((e) => e.id === hoveredBot.botId)
    : null;

  const triggerPreset = (presetId: CameraPresetId) => {
    setActivePreset(presetId);
    cameraCommandRef.current = presetId;
  };

  return (
    <div
      className="relative w-full h-full min-h-[540px] overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-800 bg-[#F1F5F9] dark:bg-slate-900"
      data-testid="virtual-office-3d"
    >
      <div ref={mountRef} className="w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 text-slate-100 p-6 text-center">
          <div>
            <p className="font-display text-lg font-semibold mb-2">3D Office Renderer Paused</p>
            <p className="text-sm text-slate-300">{webglError}</p>
          </div>
        </div>
      )}

      {hoveredEmployee && hoveredBot && (
        <div
          className="pointer-events-none absolute z-20 px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-lg max-w-[240px]"
          style={{
            left: Math.min(hoveredBot.x + 14, 720),
            top: Math.max(hoveredBot.y - 48, 12),
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: hoveredEmployee.colorHex }}
            />
            <span className="font-display text-sm font-semibold">{hoveredEmployee.name}</span>
          </div>
          <p className="text-xs font-medium mt-0.5" style={{ color: hoveredEmployee.colorHex }}>
            {hoveredEmployee.personality.archetype}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hoveredEmployee.title}</p>
          <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">
            {STATUS_LABELS[hoveredEmployee.status]} · Click to inspect
          </p>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[95%]">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-stone-200 dark:border-slate-700 shadow-sm hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Camera Dock</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-x-auto max-w-full">
            {CAMERA_PRESETS.map((preset) => {
              const active = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => triggerPreset(preset.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => triggerPreset('overview')}
              aria-label="Reset camera view"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Reset camera view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
