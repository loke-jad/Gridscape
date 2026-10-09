import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Play, Sparkles, ZoomIn, ZoomOut, MessageSquare, Share, Plus, X, Sun, Moon } from 'lucide-react';
import { GridNodeData } from './types';
import { NodeCard } from './components/NodeCard';
import { ConnectingLines } from './components/ConnectingLines';
import { Minimap } from './components/Minimap';
import { motion, AnimatePresence } from 'motion/react';

const NODE_WIDTH = 480;

const FRESH_INSPIRATIONS = [
  "Evolution of Video Games",
  "Quantum Entanglement",
  "Deep Sea Bioluminescence",
  "Brutalist Architecture",
  "History of Cryptography",
  "Mycelial Network Intelligence",
  "Origins of Written Language",
  "Black Hole Thermodynamics",
  "Fermi Paradox & Great Filters",
  "Neuroplasticity & Memory Formation",
  "Cybernetics & Feedback Loops",
  "Non-Euclidean Geometries"
];

export default function App() {
  const [nodes, setNodes] = useState<GridNodeData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [hasLinkedKey, setHasLinkedKey] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Dark Mode State
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('gridscape_theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('gridscape_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('gridscape_theme', 'light');
    }
  }, [isDark]);

  const toggleDarkMode = () => setIsDark(prev => !prev);

  // Fresh Node Creation State
  const [freshNodeQuery, setFreshNodeQuery] = useState('');
  const [showFreshModal, setShowFreshModal] = useState(false);
  const [modalInput, setModalInput] = useState('');
  const [spawnCoords, setSpawnCoords] = useState<{ x: number; y: number } | null>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  
  // Canvas Transform State
  const [transform, setTransform] = useState({ 
    x: 0, 
    y: 0, 
    scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 0.85 
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartInfo = useRef({ x: 0, y: 0, transformX: 0, transformY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodeDragStartInfo = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  // Focus tracking
  const [activeNode, setActiveNode] = useState<string | null>(null);

  // Panning Support
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only pan on left click background
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStartInfo.current = {
        x: e.clientX,
        y: e.clientY,
        transformX: transform.x,
        transformY: transform.y,
      };
      // prevent selection while dragging
      e.preventDefault();
    }
  };

  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    // Only allow drag if clicking the header or specific handle, handled by the event target in NodeCard
    e.stopPropagation();
    // Capture pointer on the element being grabbed so fast drags don't break
    e.currentTarget.setPointerCapture(e.pointerId);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    nodeDragStartInfo.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStartInfo.current.x;
      const dy = e.clientY - dragStartInfo.current.y;
      setTransform(prev => ({
        ...prev,
        x: dragStartInfo.current.transformX + dx,
        y: dragStartInfo.current.transformY + dy,
      }));
    } else if (draggingNodeId) {
      const dx = (e.clientX - nodeDragStartInfo.current.x) / transform.scale;
      const dy = (e.clientY - nodeDragStartInfo.current.y) / transform.scale;
      setNodes(prev => prev.map(n => 
        n.id === draggingNodeId ? { ...n, x: nodeDragStartInfo.current.nodeX + dx, y: nodeDragStartInfo.current.nodeY + dy } : n
      ));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setDraggingNodeId(null);
    if ((e.target as HTMLElement).hasPointerCapture && (e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    // If the scroll originated inside a node card body, custom scrollbar, or input, do NOT pan canvas!
    const target = e.target as HTMLElement;
    if (target.closest('.node-card-body, .custom-scrollbar, input, textarea, button, .modal-scroll')) {
      return;
    }

    // Disable zooming for now, just pan
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = -e.deltaY * 0.002;
      handleZoom(zoomFactor, e.clientX, e.clientY);
    } else {
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleZoom = (delta: number, originX?: number, originY?: number) => {
    setTransform(prev => {
      const newScale = Math.min(Math.max(0.2, prev.scale + delta), 3);
      
      if (originX === undefined || originY === undefined) {
        // Zoom to center if no origin given
        originX = window.innerWidth / 2;
        originY = window.innerHeight / 2;
      }

      // Adjust x and y to keep the zoom centered on the pointer
      const scaleRatio = newScale / prev.scale;
      const newX = originX - (originX - prev.x) * scaleRatio;
      const newY = originY - (originY - prev.y) * scaleRatio;

      return { x: newX, y: newY, scale: newScale };
    });
  };

  const centerOnPosition = useCallback((x: number, y: number) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform(prev => ({
      ...prev,
      x: hw - x * prev.scale - (NODE_WIDTH / 2) * prev.scale,
      y: hh - y * prev.scale - 200 * prev.scale
    }));
  }, []);

  const handleCenterViewport = useCallback((x: number, y: number) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform(prev => ({
      ...prev,
      x: hw - x * prev.scale,
      y: hh - y * prev.scale
    }));
  }, []);

  const generateNode = async (prompt: string, x: number, y: number, parentId?: string, isRegenerationOf?: string) => {
    const id = isRegenerationOf || `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create new node or update existing to 'generating'
    if (isRegenerationOf) {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, status: 'generating' } : n));
    } else {
      const newNode: GridNodeData = {
        id, x, y,
        width: NODE_WIDTH,
        prompt,
        asciiArt: '',
        imageUrl: '',
        text: '',
        prompts: [],
        status: 'generating',
        versionIndex: 0,
        versions: [],
        parentId
      };
      setNodes(prev => [...prev, newNode]);
    }
    
    // Center view locally
    // Use timeout to let render happen first
    setTimeout(() => centerOnPosition(x, y), 50);

    try {
      // 1. Fetch text
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      let insertIndex = 0;

      setNodes(prev => prev.map(node => {
        if (node.id === id) {
          insertIndex = isRegenerationOf ? node.versions.length : 0;
          const newVersion = {
            prompt,
            asciiArt: '',
            imageUrl: '',
            imageLoading: false,
            text: data.text || 'No text',
            prompts: data.prompts || [],
          };
          
          return {
            ...node,
            status: 'ready',
            versions: isRegenerationOf ? [...node.versions, newVersion] : [newVersion],
            versionIndex: insertIndex,
            text: newVersion.text,
            asciiArt: newVersion.asciiArt,
            imageUrl: newVersion.imageUrl,
            imageLoading: false,
            prompts: newVersion.prompts,
          };
        }
        return node;
      }));

    } catch (error) {
      console.error(error);
      setNodes(prev => prev.map(node => node.id === id ? { ...node, status: 'error' } : node));
    }
  };

  const handleRequestImage = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const targetVersionIndex = node.versionIndex;
    const currentVer = node.versions[targetVersionIndex];
    const prompt = currentVer?.prompt || node.prompt;

    // Set loading indicator
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        const versions = [...n.versions];
        if (versions[targetVersionIndex]) {
          versions[targetVersionIndex] = { ...versions[targetVersionIndex], imageLoading: true };
        }
        return { ...n, versions, imageLoading: true };
      }
      return n;
    }));

    const executeFetch = async () => {
      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const imgData = await res.json();
        if (imgData.imageUrl) {
          setNodes(prev => prev.map(n => {
            if (n.id === nodeId) {
              const versions = [...n.versions];
              if (versions[targetVersionIndex]) {
                versions[targetVersionIndex] = { ...versions[targetVersionIndex], imageUrl: imgData.imageUrl, imageLoading: false };
              }
              const isCurrent = n.versionIndex === targetVersionIndex;
              return { 
                ...n, 
                versions, 
                imageLoading: false,
                ...(isCurrent ? { imageUrl: imgData.imageUrl } : {}) 
              };
            }
            return n;
          }));
        } else {
          // Revert loading on error
          setNodes(prev => prev.map(n => {
            if (n.id === nodeId) {
              const versions = [...n.versions];
              if (versions[targetVersionIndex]) {
                versions[targetVersionIndex] = { ...versions[targetVersionIndex], imageLoading: false };
              }
              return { ...n, versions, imageLoading: false };
            }
            return n;
          }));
          if (imgData.error?.toLowerCase().includes('key') || imgData.error?.toLowerCase().includes('billing') || imgData.error?.toLowerCase().includes('paid')) {
            setShowBillingModal(true);
          }
        }
      } catch (err) {
        console.error('Image fetch error:', err);
        setNodes(prev => prev.map(n => {
          if (n.id === nodeId) {
            const versions = [...n.versions];
            if (versions[targetVersionIndex]) {
              versions[targetVersionIndex] = { ...versions[targetVersionIndex], imageLoading: false };
            }
            return { ...n, versions, imageLoading: false };
          }
          return n;
        }));
      }
    };

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          executeFetch();
        } else {
          setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, imageLoading: false } : n));
        }
        return;
      } else {
        setPendingAction(() => executeFetch);
        setShowBillingModal(true);
        return;
      }
    }

    executeFetch();
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const startX = 0;
    const startY = 0;
    const executeSearch = () => {
      generateNode(searchQuery, startX, startY);
      setSearchQuery('');
    };

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          executeSearch();
        }
        return;
      } else {
        setPendingAction(() => executeSearch);
        setShowBillingModal(true);
        return;
      }
    }

    executeSearch();
  };

  const handleMagicWand = async () => {
    const ideas = ["Evolution of Video Games", "Quantum Entanglement", "Rise of the Roman Empire", "History of Artificial Intelligence", "Deep Sea Ecosystems"];
    const text = ideas[Math.floor(Math.random() * ideas.length)];
    
    const executeMagicWand = () => {
      generateNode(text, 0, 0);
    };

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          executeMagicWand();
        }
        return;
      } else {
        setPendingAction(() => executeMagicWand);
        setShowBillingModal(true);
        return;
      }
    }

    executeMagicWand();
  };

  // Helper to find a free spot for a fresh disconnected node
  const getFreshNodePosition = useCallback((preferredX?: number, preferredY?: number) => {
    const baseX = preferredX !== undefined 
      ? preferredX 
      : (window.innerWidth / 2 - transform.x) / transform.scale - (NODE_WIDTH / 2);
    const baseY = preferredY !== undefined 
      ? preferredY 
      : (window.innerHeight / 2 - transform.y) / transform.scale - 200;

    const isOccupied = (testPos: { x: number; y: number }) => {
      return nodes.some(n => 
        Math.abs(n.x - testPos.x) < (NODE_WIDTH + 60) && 
        Math.abs(n.y - testPos.y) < 450
      );
    };

    if (!isOccupied({ x: baseX, y: baseY })) {
      return { x: Math.round(baseX), y: Math.round(baseY) };
    }

    const offsets = [
      { x: NODE_WIDTH + 80, y: 0 },
      { x: -(NODE_WIDTH + 80), y: 0 },
      { x: 0, y: 550 },
      { x: 0, y: -550 },
      { x: NODE_WIDTH + 80, y: 550 },
      { x: -(NODE_WIDTH + 80), y: 550 },
      { x: (NODE_WIDTH + 80) * 2, y: 0 },
      { x: -(NODE_WIDTH + 80) * 2, y: 0 },
    ];

    for (const off of offsets) {
      const cand = { x: baseX + off.x, y: baseY + off.y };
      if (!isOccupied(cand)) {
        return { x: Math.round(cand.x), y: Math.round(cand.y) };
      }
    }

    return { x: Math.round(baseX + 160), y: Math.round(baseY + 160) };
  }, [nodes, transform]);

  const createFreshNode = async (prompt: string, customPos?: { x: number; y: number }) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setShowFreshModal(false);
    setModalInput('');
    setFreshNodeQuery('');

    const targetPos = getFreshNodePosition(customPos?.x, customPos?.y);

    const execute = () => {
      // Undefined parentId creates an independent, disconnected node!
      generateNode(trimmed, targetPos.x, targetPos.y, undefined);
    };

    if (!hasLinkedKey) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        const success = await window.aistudio.openSelectKey();
        if (success !== false) {
          setHasLinkedKey(true);
          execute();
        }
        return;
      } else {
        setPendingAction(() => execute);
        setShowBillingModal(true);
        return;
      }
    }

    execute();
  };

  const handleFreshSurprise = (customPos?: { x: number; y: number }) => {
    const randomTopic = FRESH_INSPIRATIONS[Math.floor(Math.random() * FRESH_INSPIRATIONS.length)];
    createFreshNode(randomTopic, customPos);
  };

  const handleDisconnect = (nodeId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, parentId: undefined } : n));
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === containerRef.current || target.classList.contains('canvas-bg')) {
      const canvasX = (e.clientX - transform.x) / transform.scale - NODE_WIDTH / 2;
      const canvasY = (e.clientY - transform.y) / transform.scale - 200;
      setSpawnCoords({ x: canvasX, y: canvasY });
      setModalInput('');
      setShowFreshModal(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFreshModal) setShowFreshModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFreshModal]);

  const handleExpand = (prompt: string, parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    
    // Spawn to the right
    const newX = parent.x + parent.width + 400; // 400px gap for prompts and connections
    
    // Add initial offset so the line is never perfectly straight
    const initialOffset = Math.random() > 0.5 ? 200 : -200;
    let newY = parent.y + initialOffset;
    const estimatedHeight = 850; // Average node height to avoid overlap
    
    let isOccupied = true;
    let offsetMultiplier = 1;
    let direction = Math.random() > 0.5 ? 1 : -1; // 1 for down, -1 for up
    
    while (isOccupied) {
      isOccupied = nodes.some(n => 
        Math.abs(n.x - newX) < 200 && // Roughly in the same column
        Math.abs(n.y - newY) < estimatedHeight // Overlaps vertically
      );
      
      if (isOccupied) {
        newY = parent.y + initialOffset + (estimatedHeight * offsetMultiplier * direction);
        direction *= -1;
        if (direction === 1) {
          offsetMultiplier++;
        }
      }
    }
    
    generateNode(prompt, newX, newY, parentId);
  };

  const handleRegenerate = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      generateNode(node.prompt, node.x, node.y, node.parentId, nodeId);
    }
  };

  const handleDelete = (nodeId: string) => {
    // Delete this node and all descendants
    const getDescendants = (id: string, allNodes: GridNodeData[]): string[] => {
      const children = allNodes.filter(n => n.parentId === id).map(n => n.id);
      let desc = [...children];
      for (const childId of children) {
        desc = [...desc, ...getDescendants(childId, allNodes)];
      }
      return desc;
    };
    
    const toDelete = [nodeId, ...getDescendants(nodeId, nodes)];
    setNodes(prev => prev.filter(n => !toDelete.includes(n.id)));
  };

  const setVersion = (nodeId: string, versionIndex: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, versionIndex } : n));
  };
  
  const totalChars = nodes.reduce((acc, node) => acc + ((node.versions[node.versionIndex]?.text?.length) || 0), 0);

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden dot-grid canvas-bg"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleCanvasDoubleClick}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Draggable/Zoomable Canvas */}
      <div 
        className="absolute top-0 left-0 origin-top-left canvas-bg"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width: '100%',
          height: '100%'
        }}
      >
        <ConnectingLines nodes={nodes} isDark={isDark} />
        {nodes.map((node, index) => (
          <NodeCard 
            key={node.id} 
            index={index}
            node={node} 
            onExpand={handleExpand}
            onRegenerate={handleRegenerate}
            onClose={handleDelete}
            onDisconnect={handleDisconnect}
            onRequestImage={handleRequestImage}
            setVersion={setVersion}
            onPointerDown={(e) => handleNodePointerDown(e, node.id)}
          />
        ))}
      </div>

      {/* Initial Zero-State Search UI */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
          {/* Top theme toggle in zero-state */}
          <div className="absolute top-4 right-4 md:top-6 md:right-6 pointer-events-auto">
            <button
              onClick={toggleDarkMode}
              className="bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 px-3 py-2 shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.8)] hover:bg-yellow-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-black dark:text-yellow-400 flex items-center gap-2 font-mono text-xs font-bold"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              <span>{isDark ? "LIGHT" : "DARK"}</span>
            </button>
          </div>

          <h1 
            className="font-tomorrow font-bold text-4xl md:text-[60px] tracking-[-0.02em] mb-4 md:mb-2 text-black dark:text-white pointer-events-auto"
          >
            GRIDSCAPE
          </h1>
          <div className="pointer-events-auto w-full max-w-2xl bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 p-2 md:p-2 shadow-[4px_4px_0px_#000] md:shadow-[8px_8px_0px_#000] dark:shadow-[8px_8px_0px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row gap-2 sm:gap-0">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex px-2 sm:px-4 items-center">
              <Search className="text-gray-400 dark:text-zinc-500 mr-2 sm:mr-3 shrink-0" size={20} />
              <input
                autoFocus
                className="flex-1 outline-none font-sans text-base sm:text-lg lg:text-xl py-2 sm:py-3 w-full bg-transparent text-black dark:text-white"
                placeholder="What do you want to explore?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={handleSearchSubmit}
                className="flex-1 sm:flex-none sm:w-12 h-12 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors cursor-pointer"
                title="Explore topic"
              >
                <Play fill="currentColor" size={20} />
              </button>
              <button 
                onClick={handleMagicWand}
                className="flex-1 sm:flex-none sm:w-12 h-12 border-2 border-black dark:border-zinc-700 text-black dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950/40 flex items-center justify-center hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors cursor-pointer"
                title="Random concept"
              >
                <Sparkles size={20} />
              </button>
            </div>
          </div>
          <div className="mt-6 md:mt-8 text-center text-[10px] md:text-xs font-mono text-gray-500 dark:text-zinc-400 max-w-lg leading-relaxed uppercase tracking-widest px-4 md:px-0">
            GRIDSCAPE IS AN INFINITE SPATIAL-KNOWLEDGE-ENGINE FOR MAPPING COMPLEX IDEAS... START WITH ANY TOPIC AND GENERATE NON-LINEAR RESEARCH NODES...
          </div>
        </div>
      )}

      {/* Floating Header UI Elements when nodes exist */}
      {nodes.length > 0 && (
        <header className="absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-6 flex flex-wrap items-center justify-between gap-3 pointer-events-none z-30">
          {/* Brand & Reset & Theme Toggle */}
          <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
            <div className="bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 px-3 py-1.5 shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.8)] flex items-center gap-2 text-black dark:text-white">
              <span className="font-tomorrow font-bold text-xs sm:text-sm tracking-tight">GRIDSCAPE</span>
              <span className="font-mono text-[9px] bg-black dark:bg-zinc-800 text-white px-1.5 py-0.5 uppercase tracking-wider font-bold">
                {nodes.length} {nodes.length === 1 ? 'NODE' : 'NODES'}
              </span>
            </div>
            
            <button 
              onClick={() => {
                setNodes([]);
                setTransform({ 
                  x: 0, 
                  y: 0, 
                  scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 0.85 
                });
              }}
              className="bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 text-[10px] md:text-xs font-mono font-bold px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 text-black dark:text-zinc-200 transition-colors shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.8)] cursor-pointer"
              title="Reset entire canvas"
            >
              [ RESET ]
            </button>

            <button
              onClick={toggleDarkMode}
              className="bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 p-2 shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.8)] hover:bg-yellow-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-black dark:text-yellow-400"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>

          {/* Fresh Node Quick Bar */}
          <div className="pointer-events-auto flex items-center gap-2">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!freshNodeQuery.trim()) return;
                createFreshNode(freshNodeQuery);
                setFreshNodeQuery('');
              }}
              className="flex items-center bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 p-1 shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-center pl-2 pr-1 text-black dark:text-white">
                <Plus size={15} className="stroke-[3]" />
              </div>
              <input
                type="text"
                value={freshNodeQuery}
                onChange={(e) => setFreshNodeQuery(e.target.value)}
                placeholder="Start fresh disconnected node..."
                className="font-sans text-xs sm:text-sm py-1 px-1 outline-none w-36 sm:w-56 md:w-72 bg-transparent text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
              />
              <button
                type="submit"
                disabled={!freshNodeQuery.trim()}
                className="bg-black dark:bg-yellow-400 text-white dark:text-black font-mono text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1.5 hover:bg-gray-800 dark:hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
              >
                + FRESH NODE
              </button>
              <button
                type="button"
                onClick={() => handleFreshSurprise()}
                className="ml-1 bg-yellow-100 dark:bg-yellow-950/40 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 border border-black dark:border-zinc-700 p-1.5 transition-colors cursor-pointer shrink-0 text-black dark:text-yellow-400"
                title="Random fresh concept"
              >
                <Sparkles size={13} />
              </button>
            </form>

            <button
              onClick={() => {
                setSpawnCoords(null);
                setModalInput('');
                setShowFreshModal(true);
              }}
              className="hidden lg:flex bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 font-mono font-bold text-xs px-3 py-2 shadow-[3px_3px_0px_#000] dark:shadow-[3px_3px_0px_rgba(0,0,0,0.8)] hover:bg-yellow-100 dark:hover:bg-zinc-800 text-black dark:text-white transition-colors cursor-pointer items-center gap-1.5 shrink-0"
              title="Open full fresh node creator with topic ideas"
            >
              <Plus size={13} className="stroke-[3]" />
              <span>EXPLORE</span>
            </button>
          </div>
        </header>
      )}

      {/* Floating Bottom UI Elements */}
      {nodes.length > 0 && (
        <>
          {/* Capacity Badge and Hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none md:bottom-6 md:left-6 md:translate-x-0 hidden md:block z-20">
            <div className="bg-black dark:bg-[#151822] text-white border dark:border-zinc-700 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-mono text-[8px] md:text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
              <span>CAPACITY: {nodes.length} NODES</span>
              <span className="text-gray-400 dark:text-zinc-600">•</span>
              <span className="text-yellow-300 font-bold">TOUCHPAD SCROLL ISOLATED • DOUBLE-CLICK CANVAS TO SPAWN</span>
            </div>
          </div>

          {/* Tools Menu & Minimap */}
          <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 pointer-events-auto flex flex-col items-end gap-2 md:gap-4 z-20">
            <div className="hidden md:block">
              <Minimap
                nodes={nodes}
                transform={transform}
                onCenterViewport={handleCenterViewport}
                isDark={isDark}
              />
            </div>
            
            <div className="bg-black dark:bg-[#151822] text-white border dark:border-zinc-700 p-1 rounded-xl flex items-center shadow-2xl">
              <button 
                onClick={() => {
                  setSpawnCoords(null);
                  setModalInput('');
                  setShowFreshModal(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-yellow-400 text-black font-mono font-bold text-[10px] rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-300 transition-colors mr-1 cursor-pointer"
                title="Start a fresh disconnected node"
              >
                <Plus size={13} className="stroke-[3]" />
                <span>FRESH NODE</span>
              </button>

              <button
                onClick={toggleDarkMode}
                className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-zinc-800 rounded-lg transition-colors mr-1 cursor-pointer text-yellow-300"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <div className="hidden sm:block px-3 font-mono text-[10px] min-w-[70px] text-center border-r border-gray-700 dark:border-zinc-700">
                {totalChars} CH
              </div>
              
              <button 
                onClick={() => handleZoom(-0.2)}
                className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-zinc-800 rounded-lg transition-colors mx-0.5 cursor-pointer"
              >
                <ZoomOut size={15} className="md:w-[17px] md:h-[17px]" />
              </button>
              
              <button 
                onClick={() => handleZoom(0.2)}
                className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-zinc-800 rounded-lg transition-colors mr-0.5 cursor-pointer"
              >
                <ZoomIn size={15} className="md:w-[17px] md:h-[17px]" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Fresh Node Modal */}
      {showFreshModal && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs pointer-events-auto p-4"
          onClick={() => setShowFreshModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 w-full max-w-lg shadow-[6px_6px_0px_#000] dark:shadow-[6px_6px_0px_rgba(0,0,0,0.8)] p-5 md:p-6 relative flex flex-col gap-4 text-black dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-black dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-black dark:text-white"
              onClick={() => setShowFreshModal(false)}
              title="Close (Esc)"
            >
              <X size={16} />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-black dark:bg-zinc-800 text-white text-[10px] font-mono px-2 py-0.5 font-bold uppercase tracking-wider">
                  DISCONNECTED ROOT
                </span>
                {spawnCoords && (
                  <span className="text-[10px] font-mono text-gray-500 dark:text-zinc-400">
                    AT POSITION [{Math.round(spawnCoords.x)}, {Math.round(spawnCoords.y)}]
                  </span>
                )}
              </div>
              <h2 className="font-tomorrow font-bold text-xl md:text-2xl text-black dark:text-white">
                START A FRESH NODE
              </h2>
              <p className="font-mono text-xs text-gray-600 dark:text-zinc-300 mt-1 leading-relaxed">
                Creates an independent concept node disconnected from other branches. It will anchor its own cluster on the canvas.
              </p>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!modalInput.trim()) return;
                createFreshNode(modalInput, spawnCoords || undefined);
              }}
              className="flex flex-col gap-3"
            >
              <div className="border-2 border-black dark:border-zinc-700 p-2 flex items-center bg-white dark:bg-[#1a1d29] shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.8)]">
                <Search className="text-gray-400 dark:text-zinc-500 mr-2 shrink-0" size={18} />
                <input
                  autoFocus
                  ref={modalInputRef}
                  type="text"
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder="What fresh topic do you want to explore?"
                  className="w-full outline-none font-sans text-sm md:text-base py-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!modalInput.trim()}
                  className="flex-1 bg-black dark:bg-yellow-400 text-white dark:text-black font-mono font-bold text-xs py-3 px-4 border-2 border-black dark:border-zinc-700 hover:bg-gray-800 dark:hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} className="stroke-[3]" />
                  <span>SPAWN FRESH NODE</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFreshSurprise(spawnCoords || undefined)}
                  className="bg-yellow-100 dark:bg-yellow-950/40 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 border-2 border-black dark:border-zinc-700 text-black dark:text-yellow-400 font-mono font-bold text-xs py-3 px-4 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Random fresh topic"
                >
                  <Sparkles size={14} />
                  <span className="hidden sm:inline">RANDOM IDEA</span>
                </button>
              </div>
            </form>

            {/* Quick Inspo Topics */}
            <div className="pt-2 border-t border-gray-200 dark:border-zinc-800">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-2">
                Or pick an intriguing topic:
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {FRESH_INSPIRATIONS.map((topic, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => createFreshNode(topic, spawnCoords || undefined)}
                    className="bg-gray-50 dark:bg-[#1a1d29] hover:bg-yellow-100 dark:hover:bg-yellow-400/20 border border-black dark:border-zinc-700 px-2.5 py-1 text-[11px] font-mono text-black dark:text-zinc-200 transition-colors cursor-pointer text-left"
                  >
                    + {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBillingModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-auto p-4">
          <div className="bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-700 w-full max-w-lg shadow-[4px_4px_0px_#000] md:shadow-[8px_8px_0px_#000] dark:shadow-[8px_8px_0px_rgba(0,0,0,0.8)] p-4 md:p-6 relative flex flex-col gap-4 text-black dark:text-white">
            <button 
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-black dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              onClick={() => {
                setShowBillingModal(false);
                setPendingAction(null);
              }}
            >
              <X size={16} />
            </button>
            <h2 className="font-sans font-bold text-lg md:text-xl pr-8 text-black dark:text-white leading-tight">
              Visual AI generation uses premium models that require a linked API key with billing enabled.
            </h2>
            <p className="font-mono text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
              Select or link an API key from a Google Cloud project with billing enabled to generate contextual images.
            </p>
            <button
              className="mt-2 bg-black dark:bg-yellow-400 text-white dark:text-black font-mono font-bold text-sm tracking-wide py-3 px-6 hover:bg-gray-800 dark:hover:bg-yellow-300 transition-colors w-full border-2 border-black dark:border-zinc-700 cursor-pointer"
              onClick={async () => {
                setShowBillingModal(false);
                if (window.aistudio && window.aistudio.openSelectKey) {
                  await window.aistudio.openSelectKey();
                  setHasLinkedKey(true);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                } else {
                  setHasLinkedKey(true);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                }
              }}
            >
              SELECT API KEY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
