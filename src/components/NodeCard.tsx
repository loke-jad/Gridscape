import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, ChevronLeft, ChevronRight, Loader2, Unlink, Image as ImageIcon } from 'lucide-react';
import { GridNodeData } from '../types';

import ReactMarkdown from 'react-markdown';

const Typewriter = ({ text, onExpand, nodeId }: { text: string, onExpand: (prompt: string, parentId: string) => void, nodeId: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  // Pre-process text to fix bad markdown links where href has spaces
  const processedText = (text || '').replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, (match, p1, p2) => {
    return `[${p1}](${p2.replace(/\s/g, '%20')})`;
  });
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const charsPerTick = Math.max(1, Math.floor(processedText.length / 100)); // adjust speed
    const interval = setInterval(() => {
      if (i >= processedText.length) {
        clearInterval(interval);
      } else {
        setDisplayedText(processedText.slice(0, i + charsPerTick));
        i += charsPerTick;
      }
    }, 20);
    return () => clearInterval(interval);
  }, [processedText]);

  return (
    <div className="whitespace-pre-wrap">
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => (
            <button 
              type="button"
              className="font-bold underline decoration-black dark:decoration-yellow-400 decoration-2 hover:bg-yellow-200 dark:hover:bg-yellow-400/25 dark:text-yellow-300 transition-colors mx-1 inline"
              onClick={(e) => {
                e.stopPropagation();
                // Safely extract string from children if possible, or fallback to href
                let promptText = props.href || "";
                if (promptText.startsWith('#')) promptText = promptText.substring(1);
                promptText = decodeURIComponent(promptText);
                
                // If it's a relative link or something else, prefer to use children text if it's string
                if (Array.isArray(props.children) && typeof props.children[0] === 'string') {
                  promptText = props.children[0];
                } else if (typeof props.children === 'string') {
                  promptText = props.children;
                }
                onExpand(promptText, nodeId);
              }}
            >
              {props.children}
            </button>
          )
        }}
      >
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};

const LOADING_MESSAGES = [
  "Searching the internet...",
  "Looking for connections...",
  "Gathering the cool bits...",
  "Brewing some ideas...",
  "Almost there..."
];

const FunLoader = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 flex flex-col items-center justify-center text-center gap-6 min-h-[400px]">
      <div className="relative h-6 w-full flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute font-mono text-sm uppercase tracking-wider text-black dark:text-zinc-100 w-full text-center font-bold"
          >
            {LOADING_MESSAGES[index]}
          </motion.div>
        </AnimatePresence>
      </div>
      <Loader2 className="w-8 h-8 animate-spin text-black dark:text-zinc-200" />
      <div className="absolute -inset-2 border-2 border-dashed border-gray-200 dark:border-zinc-700 pointer-events-none rounded opacity-50"></div>
    </div>
  );
};

interface NodeCardProps {
  index: number;
  node: GridNodeData;
  onExpand: (prompt: string, parentId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onClose: (nodeId: string) => void;
  setVersion: (nodeId: string, versionIndex: number) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onDisconnect?: (nodeId: string) => void;
  onRequestImage?: (nodeId: string) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({ 
  index,
  node, 
  onExpand, 
  onRegenerate, 
  onClose,
  setVersion,
  onPointerDown,
  onDisconnect,
  onRequestImage
}) => {
  const version = node.versions[node.versionIndex] || node;
  const isGenerating = node.status === 'generating';
  const [showImage, setShowImage] = useState(true);
  
  const versionText = `${index + 1}.${node.versionIndex}`;

  const hasImage = Boolean(version.imageUrl);
  const isLoadingImage = Boolean(version.imageLoading);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width || 480,
        zIndex: 10
      }}
      className="flex flex-col gap-2 origin-top-left"
    >
      {/* Node Toolbar */}
      <div 
        className="flex items-center gap-2 text-xs font-mono cursor-grab active:cursor-grabbing w-fit"
        onPointerDown={(e) => onPointerDown?.(e)}
      >
        <div className="bg-white dark:bg-[#181b26] border border-black dark:border-zinc-600 rounded-full px-3 py-1.5 shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.8)] text-black dark:text-zinc-100 flex items-center gap-2.5">
          <span className="font-bold tracking-tight">NODE {versionText}</span>
          
          <div className="h-3 w-px bg-gray-300 dark:bg-zinc-700"></div>
          
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => setVersion(node.id, Math.max(0, node.versionIndex - 1))}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={node.versionIndex === 0}
              className="hover:bg-gray-100 dark:hover:bg-zinc-800 p-0.5 rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="w-7 text-center">{node.versionIndex + 1}/{node.versions.length || 1}</span>
            <button 
              onClick={() => setVersion(node.id, Math.min(node.versions.length - 1, node.versionIndex + 1))}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={node.versionIndex === node.versions.length - 1}
              className="hover:bg-gray-100 dark:hover:bg-zinc-800 p-0.5 rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="h-3 w-px bg-gray-300 dark:bg-zinc-700"></div>
          
          <span className="w-14 text-[11px] text-gray-600 dark:text-zinc-400">
            {isGenerating ? '---' : `${version.text?.length || 0} CH`}
          </span>

          <div className="h-3 w-px bg-gray-300 dark:bg-zinc-700"></div>

          {/* Image button: only pops up when needed */}
          {hasImage ? (
            <button
              onClick={() => setShowImage(!showImage)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`hover:text-yellow-500 transition-colors cursor-pointer flex items-center gap-1 ${showImage ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-gray-400 dark:text-zinc-500'}`}
              title={showImage ? "Collapse Image Preview" : "Show Image Preview"}
            >
              <ImageIcon size={14} />
              <span className="text-[10px] hidden sm:inline">{showImage ? "IMG" : "+IMG"}</span>
            </button>
          ) : isLoadingImage ? (
            <div className="flex items-center gap-1 text-[10px] text-yellow-600 dark:text-yellow-400">
              <Loader2 size={12} className="animate-spin" />
              <span className="hidden sm:inline">VISUAL</span>
            </div>
          ) : onRequestImage ? (
            <button
              onClick={() => {
                setShowImage(true);
                onRequestImage(node.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors cursor-pointer flex items-center gap-1 text-gray-500 dark:text-zinc-400"
              title="Generate visual representation"
            >
              <ImageIcon size={14} />
              <span className="text-[10px] hidden sm:inline">+VISUAL</span>
            </button>
          ) : null}
          
          <div className="h-3 w-px bg-gray-300 dark:bg-zinc-700"></div>
          
          <button 
            onClick={() => onRegenerate(node.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            title="Regenerate"
          >
            <Sparkles size={14} />
          </button>
          
          {node.parentId && onDisconnect && (
            <button 
              onClick={() => onDisconnect(node.id)}
              onPointerDown={(e) => e.stopPropagation()}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
              title="Disconnect from parent node (make fresh node)"
            >
              <Unlink size={14} />
            </button>
          )}

          <button 
            onClick={() => onClose(node.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div 
        className="flex flex-col shadow-[4px_4px_0px_#000] dark:shadow-[4px_4px_0px_rgba(0,0,0,0.8)] bg-white dark:bg-[#151822] border-2 border-black dark:border-zinc-600 rounded relative z-10"
        onPointerDown={(e) => onPointerDown?.(e)}
        onWheel={(e) => e.stopPropagation()}
      >
        
        {/* Stacked effect base lines if multiple versions */}
        {node.versions.length > 1 && (
          <>
            <div className="absolute top-1 -right-1.5 w-full h-full border-r-2 border-t-2 border-black dark:border-zinc-600 rounded bg-white dark:bg-[#151822] -z-10 shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.8)]" />
            <div className="absolute top-2 -right-3 w-full h-full border-r-2 border-t-2 border-black dark:border-zinc-600 rounded bg-white dark:bg-[#151822] -z-20 shadow-[2px_2px_0px_#000] dark:shadow-[2px_2px_0px_rgba(0,0,0,0.8)]" />
          </>
        )}

        {node.status === 'error' ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
            <div className="text-red-500 mb-2">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
            <div className="font-mono text-sm uppercase tracking-wider text-red-500">
              SYSTEM_FAULT:<br/>NEURAL ENGINE FAILURE
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-400 mt-2 font-mono">Unable to process prompt. Please try regenerating.</div>
            <div className="absolute -inset-2 border-2 border-dashed border-red-300 dark:border-red-900 pointer-events-none rounded opacity-50"></div>
          </div>
        ) : isGenerating ? (
          <FunLoader />
        ) : (
          <>
            {/* Visual Header / Image: Only pops up when it's needed! */}
            {hasImage && showImage && (
              <div className="bg-[#f8f9fa] dark:bg-[#0f1118] border-b-2 border-black dark:border-zinc-700 overflow-hidden relative min-h-[240px] max-h-[340px]">
                <img 
                  src={version.imageUrl} 
                  alt={node.prompt} 
                  className="w-full h-[280px] object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {isLoadingImage && showImage && (
              <div className="bg-yellow-50 dark:bg-yellow-950/40 border-b-2 border-black dark:border-zinc-700 p-3 flex items-center justify-center gap-2 font-mono text-xs text-yellow-800 dark:text-yellow-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating visual representation...</span>
              </div>
            )}
            
            {/* Text Content with dedicated touchpad scroll isolation & generous height */}
            <div 
              className="node-card-body p-6 min-h-[340px] max-h-[500px] overflow-y-auto custom-scrollbar text-base leading-relaxed cursor-text selection:bg-yellow-300 selection:text-black text-black dark:text-zinc-100"
              onPointerDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-xl mb-3.5 uppercase tracking-tight text-black dark:text-white">{node.prompt}</h3>
              <Typewriter text={version.text} onExpand={onExpand} nodeId={node.id} />
            </div>
          </>
        )}
      </div>

      {/* Suggested Prompts (Spawning Side) */}
      <AnimatePresence>
        {!isGenerating && version.prompts && version.prompts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.3 } }}
            className="absolute left-full bottom-0 ml-[20px] flex flex-col gap-3 w-64"
          >
            {version.prompts.map((prompt: string, idx: number) => (
              <div key={idx} className="relative group">
                {/* Visual solid horizontal line bridging the 20px gap */}
                <div className="absolute top-1/2 right-full w-[20px] h-[2px] bg-black dark:bg-zinc-600" />
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand(prompt, node.id);
                  }}
                  className="w-full relative bg-[#FFFBEA] dark:bg-[#1a1d29] border border-black dark:border-zinc-600 p-3 text-left shadow-[2px_2px_0px_rgba(0,0,0,0.2)] dark:shadow-[2px_2px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:bg-yellow-100 dark:hover:bg-yellow-400/20 text-black dark:text-zinc-200 transition-all text-xs font-medium cursor-pointer block"
                >
                  {prompt}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
