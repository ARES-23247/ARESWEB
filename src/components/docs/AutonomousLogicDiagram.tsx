import { useCallback } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { 
    id: '1', 
    type: 'input', 
    data: { label: 'Autonomous Init' }, 
    position: { x: 250, y: 0 },
    style: { background: '#C00000', color: '#fff', border: '1px solid #ffffff20', fontWeight: 'bold' }
  },
  { 
    id: '2', 
    data: { label: 'Vision: Detect Prop' }, 
    position: { x: 250, y: 100 },
    style: { background: '#1a1a1a', color: '#fff', border: '1px solid #FFB81C', borderLeft: '4px solid #FFB81C' }
  },
  { 
    id: '3a', 
    data: { label: 'Path: Left Spike' }, 
    position: { x: 50, y: 200 },
    style: { background: '#1a1a1a', color: '#fff', border: '1px solid #ffffff10' }
  },
  { 
    id: '3b', 
    data: { label: 'Path: Center Spike' }, 
    position: { x: 250, y: 200 },
    style: { background: '#1a1a1a', color: '#fff', border: '1px solid #ffffff10' }
  },
  { 
    id: '3c', 
    data: { label: 'Path: Right Spike' }, 
    position: { x: 450, y: 200 },
    style: { background: '#1a1a1a', color: '#fff', border: '1px solid #ffffff10' }
  },
  { 
    id: '4', 
    data: { label: 'Score Preload' }, 
    position: { x: 250, y: 320 },
    style: { background: '#CD7F32', color: '#000', fontWeight: 'black', border: 'none' }
  },
  { 
    id: '5', 
    type: 'output', 
    data: { label: 'Park in Backstage' }, 
    position: { x: 250, y: 420 },
    style: { background: '#00E5FF', color: '#000', border: 'none', fontWeight: 'bold' }
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#C00000' }, style: { stroke: '#C00000' } },
  { id: 'e2-3a', source: '2', target: '3a', label: 'Left', labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: '#1a1a1a' } },
  { id: 'e2-3b', source: '2', target: '3b', label: 'Center', labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: '#1a1a1a' } },
  { id: 'e2-3c', source: '2', target: '3c', label: 'Right', labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: '#1a1a1a' } },
  { id: 'e3a-4', source: '3a', target: '4' },
  { id: 'e3b-4', source: '3b', target: '4' },
  { id: 'e3c-4', source: '3c', target: '4' },
  { id: 'e4-5', source: '4', target: '5', animated: true },
];

export default function AutonomousLogicDiagram() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="h-[500px] w-full bg-obsidian border border-white/5 overflow-hidden ares-cut-lg shadow-2xl relative">
      <div className="absolute top-4 left-4 z-10">
        <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold bg-ares-gold/10 px-2 py-1 rounded border border-ares-gold/20">
          Interactive Logic Engine
        </span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="dark"
      >
        <Background color="#333" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
