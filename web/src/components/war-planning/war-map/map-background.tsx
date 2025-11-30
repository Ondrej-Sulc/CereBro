import React, { useState, useEffect, useMemo, memo } from 'react';
import { warNodesData } from '../nodes-data';

export const WarMapBackground = memo(function WarMapBackground() {
    const [stars, setStars] = useState<any[]>([]);

    useEffect(() => {
        const starCount = 400;
        const generatedStars = Array.from({ length: starCount }).map((_, i) => ({
          id: i,
          x: Math.random() * 4000 - 1500,
          y: Math.random() * 3000 - 1000,
          r: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.7 + 0.3,
          delay: Math.random() * 5 + 's',
          duration: Math.random() * 3 + 3 + 's'
        }));
        setStars(generatedStars);
    }, []);
    
    const nebulas = useMemo(() => [
        { cx: -500, cy: -500, r: 800, color: "#4c1d95", id: "nebula-0" }, // Violet
        { cx: 800, cy: 400, r: 900, color: "#1e3a8a", id: "nebula-1" },   // Blue
        { cx: 200, cy: 1200, r: 700, color: "#be185d", id: "nebula-2" },  // Pink
        { cx: 1500, cy: -200, r: 600, color: "#0f766e", id: "nebula-3" }, // Teal
    ], []);

    return (
        <>
            <defs>
              <filter id="glow-selected" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                  </feMerge>
              </filter>
              
              <radialGradient id="node-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.5)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
              </radialGradient>
              
              <radialGradient id="shadow-gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>

              {/* Class Glow Filters */}
              <filter id="glow-science" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
                  <feFlood floodColor="#4ade80" result="color"/>
                  <feComposite in="color" in2="blur" operator="in" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-skill" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
                  <feFlood floodColor="#ef4444" result="color"/>
                  <feComposite in="color" in2="blur" operator="in" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-mutant" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
                  <feFlood floodColor="#facc15" result="color"/>
                  <feComposite in="color" in2="blur" operator="in" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-cosmic" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
                  <feFlood floodColor="#22d3ee" result="color"/>
                  <feComposite in="color" in2="blur" operator="in" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-tech" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
                  <feFlood floodColor="#3b82f6" result="color"/>
                  <feComposite in="color" in2="blur" operator="in" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-mystic" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
                  <feFlood floodColor="#a855f7" result="color"/>
                  <feComposite in="color" in2="blur" operator="in" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-superior" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
                  <feFlood floodColor="#d946ef" result="color"/>
                  <feComposite in="color" in2="blur" operator="in" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>

              {nebulas.map((nebula) => (
                  <radialGradient key={nebula.id} id={nebula.id} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor={nebula.color} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={nebula.color} stopOpacity="0" />
                  </radialGradient>
              ))}
            </defs>
            
            <rect x="-2000" y="-1500" width="5000" height="4000" fill="#020617" />
            
            {/* Background elements */}
            {nebulas.map((nebula) => (
                <circle 
                    key={nebula.id}
                    cx={nebula.cx} 
                    cy={nebula.cy} 
                    r={nebula.r} 
                    fill={`url(#${nebula.id})`}
                />
            ))}

            {stars.map((star) => (
                <circle
                    key={`star-${star.id}`}
                    cx={star.x}
                    cy={star.y}
                    r={star.r}
                    fill="white"
                    opacity={star.opacity}
                    className="star-anim"
                    style={{ animationDuration: star.duration, animationDelay: star.delay }}
                />
            ))}

            {/* Paths */}
            {warNodesData.map(node => {
              return node.paths.map(pathToId => {
                const pathToNode = warNodesData.find(n => n.id === pathToId);
                if (!pathToNode) return null;
                return (
                  <line
                    key={`${node.id}-${pathToId}`}
                    x1={node.x}
                    y1={node.y}
                    x2={pathToNode.x}
                    y2={pathToNode.y}
                    stroke="#475569" 
                    strokeWidth="1"
                    strokeDasharray="4 4" 
                    opacity="0.3"
                  />
                );
              });
            })}
        </>
    );
});
