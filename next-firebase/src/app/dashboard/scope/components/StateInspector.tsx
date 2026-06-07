"use client";

import React, { useState } from "react";
import { useScopeStore } from "../store/scopeStore";
import { Search, ChevronDown, ChevronRight, Activity, TrendingUp } from "lucide-react";

interface InspectorItemProps {
  label: string;
  value: string | number;
  unit?: string;
  signalKey?: string;
  isPlottable?: boolean;
}

function InspectorItem({ label, value, unit = "", signalKey, isPlottable = false }: InspectorItemProps) {
  const { selectedKeys, toggleSelectedKey } = useScopeStore();
  const isSelected = signalKey ? selectedKeys.includes(signalKey) : false;

  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-xs">
      <span className="text-marble/70 font-mono font-medium truncate max-w-[180px]">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-white font-mono font-bold tracking-tight">
          {typeof value === "number" ? value.toFixed(3) : value}
          <span className="text-marble/35 ml-0.5 font-medium">{unit}</span>
        </span>
        
        {isPlottable && signalKey && (
          <button
            onClick={() => toggleSelectedKey(signalKey)}
            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-300 cursor-pointer ${
              isSelected
                ? "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                : "border-white/5 text-marble/35 hover:border-white/10 hover:text-marble/65"
            }`}
            title="Toggle plot visibility on line charts"
          >
            <TrendingUp size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

interface TreeNode {
  name: string;
  fullName: string;
  value?: number;
  children: Record<string, TreeNode>;
}

interface TreeNodeProps {
  node: TreeNode;
  search: string;
  depth: number;
}

function TreeNodeComponent({ node, search, depth }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth < 2); // expand top levels by default
  const hasChildren = Object.keys(node.children).length > 0;

  // Search filter recursion
  const visibleChildren = Object.values(node.children).filter((child) => {
    if (!search) return true;
    const recursiveCheck = (n: TreeNode): boolean => {
      if (n.fullName.toLowerCase().includes(search.toLowerCase())) return true;
      return Object.values(n.children).some(recursiveCheck);
    };
    return recursiveCheck(child);
  });

  if (search && !hasChildren && !node.fullName.toLowerCase().includes(search.toLowerCase())) {
    return null;
  }

  if (search && hasChildren && visibleChildren.length === 0) {
    return null;
  }

  const paddingLeft = `${depth * 10}px`;

  if (hasChildren) {
    return (
      <div className="w-full">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between py-2 text-xs text-marble/90 hover:text-white border-b border-white/5 cursor-pointer font-bold font-mono transition-colors"
          style={{ paddingLeft }}
        >
          <span className="flex items-center gap-1 text-ares-gold">
            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>{node.name}</span>
          </span>
          <span className="text-[8px] text-marble/35 uppercase font-medium mr-2">
            ({Object.keys(node.children).length} channels)
          </span>
        </button>
        {isOpen && (
          <div className="flex flex-col">
            {visibleChildren.map((child) => (
              <TreeNodeComponent key={child.fullName} node={child} search={search} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft }} className="pr-1.5">
      <InspectorItem 
        label={node.name} 
        value={node.value ?? 0} 
        signalKey={node.fullName} 
        isPlottable 
      />
    </div>
  );
}

export default function StateInspector() {
  const { telemetryData, currentTimeMs, getCurrentFrame } = useScopeStore();
  const [search, setSearch] = useState("");

  const currentFrame = getCurrentFrame();

  if (!telemetryData || !currentFrame) {
    return (
      <div className="h-full flex flex-col gap-4 p-6">
        <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3">
          🔎 State Inspector
        </h3>
        <div className="bg-black/45 border border-white/5 flex-grow rounded-xl flex items-center justify-center p-8 text-center text-marble/35 text-xs">
          Load telemetry file or BigQuery run to inspect active state nodes.
        </div>
      </div>
    );
  }

  // 1. Build TreeNode structure dynamically
  const buildTree = (keys: string[], currentValues: Record<string, number>) => {
    const root: Record<string, TreeNode> = {};
    
    keys.forEach((key) => {
      const parts = key.split("/");
      let current = root;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLeaf = i === parts.length - 1;
        const subPath = parts.slice(0, i + 1).join("/");
        
        if (!current[part]) {
          current[part] = {
            name: part,
            fullName: subPath,
            children: {},
            value: isLeaf ? currentValues[key] : undefined
          };
        }
        
        current = current[part].children;
      }
    });
    
    return root;
  };

  const allKeys = Object.keys(telemetryData.channels);
  const treeRoot = buildTree(allKeys, currentFrame.values);
  const rootNodes = Object.values(treeRoot);

  // Filter root categories by search
  const visibleRootNodes = rootNodes.filter((node) => {
    if (!search) return true;
    const recursiveCheck = (n: TreeNode): boolean => {
      if (n.fullName.toLowerCase().includes(search.toLowerCase())) return true;
      return Object.values(n.children).some(recursiveCheck);
    };
    return recursiveCheck(node);
  });

  return (
    <div className="flex flex-col gap-4 h-full p-6">
      {/* Header */}
      <div className="border-b border-white/5 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading">
          🔎 State Inspector
        </h3>
        <span className="bg-white/5 border border-white/10 text-[9px] font-mono px-2 py-0.5 text-marble/55 rounded-md">
          {allKeys.length} channels
        </span>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-marble/30">
          <Search size={12} />
        </span>
        <input
          type="text"
          placeholder="Filter telemetry keys..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl pl-9.5 pr-4 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
        />
      </div>

      {/* Collapsible States Tree */}
      <div className="flex-grow overflow-y-auto space-y-2 max-h-[360px] pr-1">
        {visibleRootNodes.length === 0 ? (
          <div className="text-center py-8 text-marble/25 text-xs font-mono">
            No keys match your query
          </div>
        ) : (
          visibleRootNodes.map((node) => (
            <div key={node.fullName} className="border border-white/5 bg-black/25 rounded-xl overflow-hidden mb-3">
              <TreeNodeComponent node={node} search={search} depth={0} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
