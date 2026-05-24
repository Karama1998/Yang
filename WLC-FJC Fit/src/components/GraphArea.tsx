import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, MousePointer, Hand, Crosshair } from 'lucide-react';
import { DataPoint, ModelType, ChainParameters, CoordinateShift } from '../types';
import { wlcForce, fjcExtension } from '../utils/polymerFit';

interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface GraphAreaProps {
  points: DataPoint[];
  modelType: ModelType;
  params: ChainParameters;
  coordinateShift: CoordinateShift;
  viewport: Viewport;
  onViewportChange: (vp: Viewport) => void;
  pickedX: number | null;
  onPickX: (x: number) => void;
  isPickingMode: boolean;
  onTogglePickingMode: (active: boolean) => void;
  onCursorMove: (x: number | null, y: number | null) => void;
  onResetViewport: () => void;
  currentFileName: string;
}

export default function GraphArea({
  points,
  modelType,
  params,
  coordinateShift,
  viewport,
  onViewportChange,
  pickedX,
  onPickX,
  isPickingMode,
  onTogglePickingMode,
  onCursorMove,
  onResetViewport,
  currentFileName,
}: GraphAreaProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanningRef = useRef(false);
  const [renderMode, setRenderMode] = useState<'line' | 'points' | 'both'>('both');
  const [hoverSnappedPoint, setHoverSnappedPoint] = useState<DataPoint | null>(null);
  const [panStart, setPanStart] = useState<{
    x: number;
    y: number;
    xMin_start: number;
    xMax_start: number;
    yMin_start: number;
    yMax_start: number;
  } | null>(null);

  // Svg internal dimension
  const W = 800;
  const H = 500;
  
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 55;

  const plotWidth = W - paddingLeft - paddingRight;
  const plotHeight = H - paddingTop - paddingBottom;

  // Coordinate Conversion Helpers
  const virtualToScreenX = (vx: number) => {
    return paddingLeft + ((vx - viewport.xMin) / (viewport.xMax - viewport.xMin)) * plotWidth;
  };

  const virtualToScreenY = (vy: number) => {
    return H - paddingBottom - ((vy - viewport.yMin) / (viewport.yMax - viewport.yMin)) * plotHeight;
  };

  const screenToVirtualX = (sx: number) => {
    return viewport.xMin + ((sx - paddingLeft) / plotWidth) * (viewport.xMax - viewport.xMin);
  };

  const screenToVirtualY = (sy: number) => {
    return viewport.yMin + ((H - paddingBottom - sy) / plotHeight) * (viewport.yMax - viewport.yMin);
  };

  // 2D Screen distance snap finder for highest precision point-picking
  const findClosestPoint = (sx: number, sy: number): DataPoint | null => {
    if (points.length === 0) return null;
    let bestDistSq = Infinity;
    let closest: DataPoint | null = null;
    for (const p of points) {
      const px = virtualToScreenX(p.x);
      const py = virtualToScreenY(p.y);
      const distSq = Math.pow(px - sx, 2) + Math.pow(py - sy, 2);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        closest = p;
      }
    }
    return closest;
  };

  // Zoom function around a center point with optional independent axes
  const handleZoom = (factorX: number, factorY: number, cx?: number, cy?: number) => {
    const cenX = cx !== undefined ? cx : (viewport.xMin + viewport.xMax) / 2;
    const cenY = cy !== undefined ? cy : (viewport.yMin + viewport.yMax) / 2;

    const halfX = ((viewport.xMax - viewport.xMin) * factorX) / 2;
    const halfY = ((viewport.yMax - viewport.yMin) * factorY) / 2;

    onViewportChange({
      xMin: cenX - halfX,
      xMax: cenX + halfX,
      yMin: cenY - halfY,
      yMax: cenY + halfY,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.95 : 1.05;
    
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();

    // Scale coordinates according to inner 800x500 dimension
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;

    const vx = screenToVirtualX(sx);
    const vy = screenToVirtualY(sy);

    if (e.shiftKey) {
      // Zoom X individually
      handleZoom(zoomFactor, 1.0, vx, vy);
    } else if (e.ctrlKey || e.altKey || e.metaKey) {
      // Zoom Y individually
      handleZoom(1.0, zoomFactor, vx, vy);
    } else {
      // Zoom both
      handleZoom(zoomFactor, zoomFactor, vx, vy);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    
    // Virtual coordinates
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const vx = screenToVirtualX(sx);

    if (isPickingMode) {
      const closest = findClosestPoint(sx, sy);
      if (closest) {
        onPickX(closest.x);
      } else {
        onPickX(vx);
      }
      onTogglePickingMode(false); // Turn off picking mode after action completed
      setHoverSnappedPoint(null);
      return;
    }

    // Start panning
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      xMin_start: viewport.xMin,
      xMax_start: viewport.xMax,
      yMin_start: viewport.yMin,
      yMax_start: viewport.yMax,
    });
    isPanningRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();

    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;

    const vx = screenToVirtualX(sx);
    const vy = screenToVirtualY(sy);

    if (isPickingMode && points.length > 0) {
      const closest = findClosestPoint(sx, sy);
      setHoverSnappedPoint(closest);
      if (closest) {
        onCursorMove(closest.x, closest.y);
      } else {
        onCursorMove(vx, vy);
      }
    } else {
      setHoverSnappedPoint(null);
      // Communicate cursor coordinate changes
      if (sx >= paddingLeft && sx <= W - paddingRight && sy >= paddingTop && sy <= H - paddingBottom) {
        onCursorMove(vx, vy);
      } else {
        onCursorMove(null, null);
      }
    }

    if (!isPanningRef.current || !panStart) return;

    const dxPixels = e.clientX - panStart.x;
    const dyPixels = e.clientY - panStart.y;

    const rectReal = svgRef.current.getBoundingClientRect();
    const W_real = rectReal.width;
    const H_real = rectReal.height;

    // Convert pixel dx to model data delta scaling
    const rangeX = panStart.xMax_start - panStart.xMin_start;
    const rangeY = panStart.yMax_start - panStart.yMin_start;

    const plotWidthReal = (plotWidth / W) * W_real;
    const plotHeightReal = (plotHeight / H) * H_real;

    const deltaX = (dxPixels / plotWidthReal) * rangeX;
    const deltaY = (dyPixels / plotHeightReal) * rangeY;

    onViewportChange({
      xMin: panStart.xMin_start - deltaX,
      xMax: panStart.xMax_start - deltaX,
      yMin: panStart.yMin_start + deltaY,
      yMax: panStart.yMax_start + deltaY,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerLeave = () => {
    onCursorMove(null, null);
    isPanningRef.current = false;
  };

  // Generate ticks for dynamic grids
  const generateTicks = (min: number, max: number, count: number = 5) => {
    const range = max - min;
    if (range <= 0) return [];
    
    // Choose nice interval sizes
    const tempInterval = range / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(tempInterval)));
    const residual = tempInterval / magnitude;
    
    let niceInterval = magnitude;
    if (residual > 5) niceInterval = 5 * magnitude;
    else if (residual > 2) niceInterval = 2 * magnitude;
    else if (residual > 1.5) niceInterval = 1.5 * magnitude;

    const firstTick = Math.ceil(min / niceInterval) * niceInterval;
    const ticks: number[] = [];
    
    for (let current = firstTick; current <= max; current += niceInterval) {
      ticks.push(parseFloat(current.toFixed(4)));
    }
    
    return ticks;
  };

  const xTicks = generateTicks(viewport.xMin, viewport.xMax, 6);
  const yTicks = generateTicks(viewport.yMin, viewport.yMax, 6);

  // Generate drawing path for experimental points
  let dataPath = '';
  if (points.length > 0) {
    dataPath = 'M ' + points
      .map(p => {
        const sx = virtualToScreenX(p.x);
        const sy = virtualToScreenY(p.y);
        return `${sx},${sy}`;
      })
      .join(' L ');
  }

  // Generate model curve paths
  let modelPath = '';
  if (params.contourLength > 0) {
    if (modelType === 'WLC') {
      // For WLC, we cover extension values x from 0 to min(current xMax, Lc)
      const xStart = Math.max(0, viewport.xMin);
      const xEnd = Math.min(viewport.xMax, params.contourLength * 0.998);
      
      if (xEnd > xStart) {
        const resolution = 150;
        const pts: string[] = [];
        for (let i = 0; i <= resolution; i++) {
          const vx = xStart + (i / resolution) * (xEnd - xStart);
          const vy = wlcForce(vx, params.persistenceLength, params.contourLength);
          const sx = virtualToScreenX(vx);
          const sy = virtualToScreenY(vy);
          if (!isNaN(sx) && !isNaN(sy) && sy >= 0 && sy <= H) {
            pts.push(`${sx},${sy}`);
          }
        }
        if (pts.length > 0) {
          modelPath = 'M ' + pts.join(' L ');
        }
      }
    } else {
      // For FJC, we sweep force values F from min to max across viewport, calculating extension
      const yStart = Math.max(0, viewport.yMin);
      const yEnd = viewport.yMax;
      
      if (yEnd > yStart) {
        const resolution = 150;
        const pts: string[] = [];
        for (let i = 0; i <= resolution; i++) {
          const vy = yStart + (i / resolution) * (yEnd - yStart);
          const vx = fjcExtension(vy, params.kuhnLength, params.contourLength);
          const sx = virtualToScreenX(vx);
          const sy = virtualToScreenY(vy);
          if (!isNaN(sx) && !isNaN(sy)) {
            pts.push(`${sx},${sy}`);
          }
        }
        if (pts.length > 0) {
          modelPath = 'M ' + pts.join(' L ');
        }
      }
    }
  }

  // Pick point screen position
  let pickLineX = 0;
  let pickCircle = { cx: 0, cy: 0, show: false };
  if (pickedX !== null) {
    pickLineX = virtualToScreenX(pickedX);
    
    // Find force coordinate at pickedX to draw a target highlight dot
    // Look up in experimental points
    let forceAtPick = 0;
    if (points.length > 0) {
      const closest = points.reduce((prev, curr) => 
        Math.abs(curr.x - pickedX) < Math.abs(prev.x - pickedX) ? curr : prev
      );
      forceAtPick = closest.y;
    } else {
      forceAtPick = wlcForce(pickedX, params.persistenceLength, params.contourLength);
    }

    pickCircle = {
      cx: virtualToScreenX(pickedX),
      cy: virtualToScreenY(forceAtPick),
      show: pickedX >= viewport.xMin && pickedX <= viewport.xMax && forceAtPick >= viewport.yMin && forceAtPick <= viewport.yMax
    };
  }

  return (
    <section className="flex-1 flex flex-col relative bg-slate-50 border-r border-slate-100" id="graph-main">
      {/* HUD Control Panels */}
      <div className="absolute top-4 left-4 flex flex-col md:flex-row items-stretch md:items-center gap-2.5 bg-white/95 backdrop-blur border border-slate-200 p-1.5 rounded-xl shadow-md z-20 pointer-events-auto">
        {/* Unified Zoom Group */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg p-0.5" title="Overall Zoom">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2 font-mono">Zoom</span>
          <button
            onClick={() => handleZoom(0.7, 0.7)}
            className="p-1 hover:bg-white rounded hover:shadow-sm text-slate-700 transition"
            title="Zoom In Both Axes (Wheel Up)"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => handleZoom(1.4, 1.4)}
            className="p-1 hover:bg-white rounded hover:shadow-sm text-slate-700 transition"
            title="Zoom Out Both Axes (Wheel Down)"
          >
            <ZoomOut size={14} />
          </button>
        </div>

        {/* X Zoom Group */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg p-0.5" title="Zoom X-Axis (Extension Only)">
          <span className="text-[10px] uppercase font-extrabold text-blue-600 px-2 font-mono">X-Axis</span>
          <button
            onClick={() => handleZoom(0.7, 1.0)}
            className="px-2 py-0.5 text-[10px] font-bold hover:bg-white rounded hover:shadow-sm text-slate-700 transition border border-transparent hover:border-slate-100"
            title="Zoom In X Only (Shift + Wheel Up)"
          >
            + In
          </button>
          <button
            onClick={() => handleZoom(1.4, 1.0)}
            className="px-2 py-0.5 text-[10px] font-bold hover:bg-white rounded hover:shadow-sm text-slate-700 transition border border-transparent hover:border-slate-100"
            title="Zoom Out X Only (Shift + Wheel Down)"
          >
            - Out
          </button>
        </div>

        {/* Y Zoom Group */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg p-0.5" title="Zoom Y-Axis (Force Only)">
          <span className="text-[10px] uppercase font-extrabold text-indigo-600 px-2 font-mono">Y-Axis</span>
          <button
            onClick={() => handleZoom(1.0, 0.7)}
            className="px-2 py-0.5 text-[10px] font-bold hover:bg-white rounded hover:shadow-sm text-slate-700 transition border border-transparent hover:border-slate-100"
            title="Zoom In Y Only (Ctrl + Wheel Up)"
          >
            + In
          </button>
          <button
            onClick={() => handleZoom(1.0, 1.4)}
            className="px-2 py-0.5 text-[10px] font-bold hover:bg-white rounded hover:shadow-sm text-slate-700 transition border border-transparent hover:border-slate-100"
            title="Zoom Out Y Only (Ctrl + Wheel Down)"
          >
            - Out
          </button>
        </div>

        {/* Render Style Group */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg p-0.5" title="Experimental Curve Styling Mode">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2 font-mono">Trace</span>
          <button
            onClick={() => setRenderMode('line')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded hover:shadow-sm transition ${
              renderMode === 'line'
                ? 'bg-white text-rose-600 font-extrabold shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Render continuous connected raw trace line"
          >
            Line
          </button>
          <button
            onClick={() => setRenderMode('points')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded hover:shadow-sm transition ${
              renderMode === 'points'
                ? 'bg-white text-rose-600 font-extrabold shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Render raw discrete unshaded AFM datapoints"
          >
            Dots
          </button>
          <button
            onClick={() => setRenderMode('both')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded hover:shadow-sm transition ${
              renderMode === 'both'
                ? 'bg-white text-rose-600 font-extrabold shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Render both continuous path and raw discrete points"
          >
            Both
          </button>
        </div>

        <div className="hidden md:block w-[1px] h-5 bg-slate-200 mx-0.5"></div>

        {/* Action controls */}
        <div className="flex items-center gap-1 px-1">
          <button
            onClick={onResetViewport}
            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition"
            title="Reset/Auto-fit Viewport"
          >
            <Maximize2 size={14} />
          </button>
          
          {/* Toggle Range Selection Mode */}
          <button
            onClick={() => onTogglePickingMode(!isPickingMode)}
            className={`px-3 py-1 text-[11px] font-extrabold rounded-md flex items-center gap-1 transition-all ${
              isPickingMode
                ? 'bg-blue-600 text-white shadow-md shadow-blue-100 animate-pulse'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Click to activate fitting range picker on the graph canvas"
          >
            <Crosshair size={12} />
            <span>{isPickingMode ? 'Click Plot to Pick' : 'Pick Fitting Point'}</span>
          </button>
        </div>
      </div>

      {/* Floating hints */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 pointer-events-none z-10 hidden lg:flex">
        <span className="text-[10px] bg-slate-100/80 backdrop-blur border border-slate-200/50 text-slate-600 px-2.5 py-1 rounded-md font-medium flex items-center gap-1">
          <Hand size={11} strokeWidth={2.5} className="text-slate-400" /> Drag to pan
        </span>
        <span className="text-[10px] bg-slate-100/80 backdrop-blur border border-slate-200/50 text-slate-600 px-2.5 py-1 rounded-md font-medium">
          Scroll: Zoom | <b>Shift + Scroll</b>: X Zoom | <b>Ctrl + Scroll</b>: Y Zoom
        </span>
      </div>

      {/* Primary SVG plotting canvas */}
      <div className="flex-1 bg-white relative m-4 rounded-xl border border-slate-200 shadow-sm overflow-hidden select-none">
        
        {isPickingMode && (
          <div className="absolute inset-0 bg-blue-50/15 border-2 border-blue-400 border-dashed rounded-xl pointer-events-none z-10 flex items-center justify-center">
            <span className="bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-bounce shadow">
              <Crosshair size={13} className="text-blue-400" /> Click on the graph to set the Upper Fitting Boundary
            </span>
          </div>
        )}

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${H}`}
          className={`absolute inset-0 touch-none ${isPickingMode ? 'cursor-crosshair' : isPanningRef.current ? 'cursor-grabbing' : 'cursor-grab'}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            <clipPath id="plot-clip">
              <rect
                x={paddingLeft}
                y={paddingTop}
                width={plotWidth}
                height={plotHeight}
              />
            </clipPath>
          </defs>

          {/* Dynamic Grid Alignment Lines */}
          <g className="grid-lines">
            {xTicks.map((x, idx) => {
              const sx = virtualToScreenX(x);
              if (sx < paddingLeft || sx > W - paddingRight) return null;
              return (
                <line
                  key={`x-grid-${idx}`}
                  x1={sx}
                  y1={paddingTop}
                  x2={sx}
                  y2={H - paddingBottom}
                  stroke="#f1f5f9"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                />
              );
            })}
            {yTicks.map((y, idx) => {
              const sy = virtualToScreenY(y);
              if (sy < paddingTop || sy > H - paddingBottom) return null;
              return (
                <line
                  key={`y-grid-${idx}`}
                  x1={paddingLeft}
                  y1={sy}
                  x2={W - paddingRight}
                  y2={sy}
                  stroke="#f1f5f9"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                />
              );
            })}
          </g>

          {/* Shaded Fitting Boundary Region */}
          {pickedX !== null && pickedX > viewport.xMin && (
            <g className="fitting-region" clipPath="url(#plot-clip)">
              <rect
                x={virtualToScreenX(Math.max(0, viewport.xMin))}
                y={paddingTop}
                width={Math.min(pickLineX, W - paddingRight) - virtualToScreenX(Math.max(0, viewport.xMin))}
                height={plotHeight}
                fill="#eff6ff"
                opacity="0.45"
              />
            </g>
          )}

          {/* Axis borders */}
          <line
            x1={paddingLeft}
            y1={H - paddingBottom}
            x2={W - paddingRight}
            y2={H - paddingBottom}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={H - paddingBottom}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* X Axis ticks labels */}
          <g className="x-labels text-[10px] fill-slate-400 font-mono">
            {xTicks.map((x, idx) => {
              const sx = virtualToScreenX(x);
              if (sx < paddingLeft - 5 || sx > W - paddingRight + 5) return null;
              return (
                <g key={`x-tick-${idx}`}>
                  <line x1={sx} y1={H - paddingBottom} x2={sx} y2={H - paddingBottom + 4} stroke="#94a3b8" />
                  <text x={sx} y={H - paddingBottom + 16} textAnchor="middle">
                    {x}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Y Axis ticks labels */}
          <g className="y-labels text-[10px] fill-slate-400 font-mono">
            {yTicks.map((y, idx) => {
              const sy = virtualToScreenY(y);
              if (sy < paddingTop - 5 || sy > H - paddingBottom + 5) return null;
              return (
                <g key={`y-tick-${idx}`}>
                  <line x1={paddingLeft - 4} y1={sy} x2={paddingLeft} y2={sy} stroke="#94a3b8" />
                  <text x={paddingLeft - 8} y={sy + 3} textAnchor="end">
                    {y}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Axis Titles */}
          <text
            x={paddingLeft + plotWidth / 2}
            y={H - 12}
            textAnchor="middle"
            className="text-[11px] font-semibold fill-slate-500"
          >
            Extension (nm)
          </text>
          
          <text
            x={18}
            y={paddingTop + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${18} ${paddingTop + plotHeight / 2})`}
            className="text-[11px] font-semibold fill-slate-500"
          >
            Force (pN)
          </text>

          {/* Render parsed JPK experimental curve */}
          {dataPath && (renderMode === 'line' || renderMode === 'both') && (
            <path
              d={dataPath}
              stroke="#ef4444"
              strokeWidth="1.8"
              fill="none"
              opacity="0.95"
              className="transition-all duration-75 text-rose-500"
              clipPath="url(#plot-clip)"
            />
          )}

          {/* Render individual discrete raw experimental AFM force spectroscopy dots */}
          {(renderMode === 'points' || renderMode === 'both') && (() => {
            // Render up to 1000 dots safely to ensure butter-smooth zoom and drag
            const maxDots = 1000;
            const step = Math.ceil(points.length / maxDots) || 1;
            const dots: React.ReactNode[] = [];
            for (let i = 0; i < points.length; i += step) {
              const p = points[i];
              const cx = virtualToScreenX(p.x);
              const cy = virtualToScreenY(p.y);
              if (cx >= paddingLeft && cx <= W - paddingRight && cy >= paddingTop && cy <= H - paddingBottom) {
                dots.push(
                  <circle
                    key={`raw-dot-${p.index}`}
                    cx={cx}
                    cy={cy}
                    r="2.2"
                    fill="#ec4899" // Vibrant pink/rose for discrete un-smoothed scatter points
                    opacity="0.9"
                  />
                );
              }
            }
            return <g className="raw-points" clipPath="url(#plot-clip)">{dots}</g>;
          })()}

          {/* Sub-pixel snapping tooltip & visual helper active in Picking/Fitting Mode */}
          {isPickingMode && hoverSnappedPoint && (
            <g className="snapping-preview pointer-events-none">
              <line
                x1={virtualToScreenX(hoverSnappedPoint.x)}
                y1={paddingTop}
                x2={virtualToScreenX(hoverSnappedPoint.x)}
                y2={H - paddingBottom}
                stroke="#3b82f6"
                strokeWidth="1.2"
                strokeDasharray="3,3"
                opacity="0.8"
              />
              <line
                x1={paddingLeft}
                y1={virtualToScreenY(hoverSnappedPoint.y)}
                x2={virtualToScreenX(hoverSnappedPoint.x)}
                y2={virtualToScreenY(hoverSnappedPoint.y)}
                stroke="#3b82f6"
                strokeWidth="1.2"
                strokeDasharray="3,3"
                opacity="0.8"
              />
              <circle
                cx={virtualToScreenX(hoverSnappedPoint.x)}
                cy={virtualToScreenY(hoverSnappedPoint.y)}
                r="8"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                className="animate-ping"
              />
              <circle
                cx={virtualToScreenX(hoverSnappedPoint.x)}
                cy={virtualToScreenY(hoverSnappedPoint.y)}
                r="5.5"
                fill="#2563eb"
                stroke="white"
                strokeWidth="2"
              />
              <g transform={`translate(${Math.min(W - paddingRight - 150, Math.max(paddingLeft + 12, virtualToScreenX(hoverSnappedPoint.x) + 12))}, ${Math.min(H - paddingBottom - 45, Math.max(paddingTop + 10, virtualToScreenY(hoverSnappedPoint.y) - 25))})`}>
                <rect
                  width="135"
                  height="34"
                  rx="6"
                  fill="#0f172a"
                  opacity="0.95"
                  className="shadow-lg border border-slate-700"
                />
                <text x="8" y="14" fill="#60a5fa" fontSize="9" fontFamily="monospace" fontWeight="bold">
                  SNAP X: {hoverSnappedPoint.x.toFixed(2)} nm
                </text>
                <text x="8" y="25" fill="#f1f5f9" fontSize="9" fontFamily="monospace" fontWeight="medium">
                  FORCE: {hoverSnappedPoint.y.toFixed(2)} pN
                </text>
              </g>
            </g>
          )}

          {/* Render mathematical theoretical curve */}
          {modelPath && (
            <path
              d={modelPath}
              stroke="#3b82f6"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              className="transition-all duration-75"
              clipPath="url(#plot-clip)"
            />
          )}

          {/* Selected fitting point vertical marker */}
          {pickedX !== null && pickLineX >= paddingLeft && pickLineX <= W - paddingRight && (
            <g className="fitting-boundary-indicator">
              <line
                x1={pickLineX}
                y1={paddingTop}
                x2={pickLineX}
                y2={H - paddingBottom}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              {pickCircle.show && (
                <>
                  <circle
                    cx={pickCircle.cx}
                    cy={pickCircle.cy}
                    r="5"
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <rect
                    x={pickLineX + 8}
                    y={Math.max(paddingTop + 5, pickCircle.cy - 12)}
                    width="100"
                    height="18"
                    rx="3"
                    fill="#ef4444"
                    opacity="0.9"
                  />
                  <text
                    x={pickLineX + 14}
                    y={Math.max(paddingTop + 17, pickCircle.cy + 1)}
                    fill="white"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    Fitting Boundary
                  </text>
                </>
              )}
            </g>
          )}
        </svg>

        {/* Legend info panel */}
        <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur text-white text-[10px] p-3 rounded-lg font-mono space-y-1 z-10 border border-slate-700 max-w-[270px]">
          <div className="flex justify-between gap-6">
            <span className="text-slate-400">Experimental:</span>
            <span className="text-red-400 truncate">{currentFileName}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-slate-400">Theoretical:</span>
            <span className="text-blue-400">
              {modelType === 'WLC' ? 'Marko-Siggia WLC' : 'Langevin FJC'}
            </span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-slate-400">Fitting Scope:</span>
            <span>{pickedX !== null ? `0 - ${pickedX.toFixed(1)} nm` : 'Not Defined'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
