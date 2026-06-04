import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, MousePointer, Hand, Crosshair, Camera, Download, ChevronDown } from 'lucide-react';
import { DataPoint, ModelType, ChainParameters, CoordinateShift, FitResults } from '../types';
import { wlcForce, fjcExtension } from '../utils/polymerFit';

interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface GraphAreaProps {
  points: DataPoint[];
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
  fitResultsWlc: FitResults | null;
  fitResultsFjc: FitResults | null;
}

export default function GraphArea({
  points,
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
  fitResultsWlc,
  fitResultsFjc,
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

  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Svg internal dimension
  const W = 800;
  const H = 500;

  const exportAsSvg = () => {
    if (!svgRef.current) return;
    try {
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      
      // Add visual background element directly inside exported SVG for portability
      const rectBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rectBg.setAttribute("width", "100%");
      rectBg.setAttribute("height", "100%");
      rectBg.setAttribute("fill", "#ffffff");
      svgClone.insertBefore(rectBg, svgClone.firstChild);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = currentFileName ? currentFileName.replace(/\.[^/.]+$/, "") : "plot";
      link.href = url;
      link.download = `polymerfit_${safeName}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export SVG:", err);
    }
  };

  const exportAsPng = () => {
    if (!svgRef.current) return;
    try {
      const svgElement = svgRef.current;
      const serializer = new XMLSerializer();
      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      
      const rectBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rectBg.setAttribute("width", "100%");
      rectBg.setAttribute("height", "100%");
      rectBg.setAttribute("fill", "#ffffff");
      svgClone.insertBefore(rectBg, svgClone.firstChild);

      const svgString = serializer.serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = URL.createObjectURL(svgBlob);
      
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2.5; // High definition scaling
        canvas.width = W * scale;
        canvas.height = H * scale;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.scale(scale, scale);
          context.drawImage(image, 0, 0, W, H);
          
          try {
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const safeName = currentFileName ? currentFileName.replace(/\.[^/.]+$/, "") : "plot";
            link.href = pngUrl;
            link.download = `polymerfit_${safeName}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (canvasErr) {
            console.error("Canvas toDataURL failed:", canvasErr);
          }
        }
        URL.revokeObjectURL(blobURL);
      };
      image.onerror = (e) => {
        console.error("Image load error on SVG rasterization:", e);
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error("Failed to export PNG:", err);
    }
  };
  
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

    const newXMin = cenX - factorX * (cenX - viewport.xMin);
    const newXMax = cenX + factorX * (viewport.xMax - cenX);
    const newYMin = cenY - factorY * (cenY - viewport.yMin);
    const newYMax = cenY + factorY * (viewport.yMax - cenY);

    onViewportChange({
      xMin: newXMin,
      xMax: newXMax,
      yMin: newYMin,
      yMax: newYMax,
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

  // Helper functions to generate mathematical paths
  const generateWlcPath = (Lp: number, Lc: number) => {
    if (Lc <= 0 || Lp <= 0) return '';
    const xStart = Math.max(0, viewport.xMin);
    const xEnd = Math.min(viewport.xMax, Lc * 0.998);
    if (xEnd <= xStart) return '';
    const resolution = 150;
    const pts: string[] = [];
    for (let i = 0; i <= resolution; i++) {
      const vx = xStart + (i / resolution) * (xEnd - xStart);
      const vy = wlcForce(vx, Lp, Lc);
      const sx = virtualToScreenX(vx);
      const sy = virtualToScreenY(vy);
      if (!isNaN(sx) && !isNaN(sy) && sy >= 0 && sy <= H) {
        pts.push(`${sx},${sy}`);
      }
    }
    return pts.length > 0 ? 'M ' + pts.join(' L ') : '';
  };

  const generateFjcPath = (Lk: number, Lc: number) => {
    if (Lc <= 0 || Lk <= 0) return '';
    const yStart = Math.max(0, viewport.yMin);
    const yEnd = viewport.yMax;
    if (yEnd <= yStart) return '';
    const resolution = 150;
    const pts: string[] = [];
    for (let i = 0; i <= resolution; i++) {
      const vy = yStart + (i / resolution) * (yEnd - yStart);
      const vx = fjcExtension(vy, Lk, Lc);
      const sx = virtualToScreenX(vx);
      const sy = virtualToScreenY(vy);
      if (!isNaN(sx) && !isNaN(sy)) {
        pts.push(`${sx},${sy}`);
      }
    }
    return pts.length > 0 ? 'M ' + pts.join(' L ') : '';
  };

  const wlcPath = generateWlcPath(params.persistenceLength, params.contourLengthWlc);
  const fjcPath = generateFjcPath(params.kuhnLength, params.contourLengthFjc);

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
      forceAtPick = wlcForce(pickedX, params.persistenceLength, params.contourLengthWlc);
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
        <div className="flex items-center gap-1.5 px-1">
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

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="px-2.5 py-1 text-[11px] font-extrabold text-slate-700 hover:bg-slate-100 rounded-md flex items-center gap-1.5 transition-all border border-slate-200"
              title="Export high-resolution plot image"
            >
              <Camera size={12} className="text-slate-500" />
              <span>Export</span>
              <ChevronDown size={11} className={`text-slate-400 transition-transform duration-200 ${isExportOpen ? 'rotate-180' : ''}`} />
            </button>
            {isExportOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-32 z-30 font-sans">
                <button
                  onClick={() => {
                    exportAsPng();
                    setIsExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                >
                  <Camera size={12} className="text-pink-500" />
                  <span>Export PNG</span>
                </button>
                <button
                  onClick={() => {
                    exportAsSvg();
                    setIsExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors border-t border-slate-100"
                >
                  <Download size={12} className="text-blue-500" />
                  <span>Export SVG</span>
                </button>
              </div>
            )}
          </div>
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
          <g className="x-labels" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace">
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
          <g className="y-labels" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace">
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
            fill="#64748b"
            fontSize="11.5"
            fontWeight="600"
            fontFamily="Inter, system-ui, -apple-system, sans-serif"
          >
            Extension (nm)
          </text>
          
          <text
            x={18}
            y={paddingTop + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${18} ${paddingTop + plotHeight / 2})`}
            fill="#64748b"
            fontSize="11.5"
            fontWeight="600"
            fontFamily="Inter, system-ui, -apple-system, sans-serif"
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

          {/* Render both WLC & FJC curves: Adjustable model lines */}
          
          {/* WLC Model Curve (Solid Blue) */}
          {wlcPath && (
            <path
              d={wlcPath}
              stroke="#2563eb"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
              className="transition-all duration-75"
              clipPath="url(#plot-clip)"
              id="wlc-fitting-path"
            />
          )}

          {/* FJC Model Curve (Solid Purple) */}
          {fjcPath && (
            <path
              d={fjcPath}
              stroke="#8b5cf6"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
              className="transition-all duration-75"
              clipPath="url(#plot-clip)"
              id="fjc-fitting-path"
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
        <div className="absolute bottom-4 right-4 bg-slate-900/95 backdrop-blur text-white text-[10px] p-3 rounded-xl font-mono space-y-2.5 z-10 border border-slate-700 w-64 shadow-xl font-medium" id="plot-legend">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 font-bold">
            Plot Legend
          </div>
          
          {/* Experimental Trace */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full shrink-0 animate-pulse"></span>
            <span className="text-slate-300">Measured:</span>
            <span className="text-red-400 truncate ml-auto max-w-[110px]" title={currentFileName}>
              {currentFileName}
            </span>
          </div>

          {/* Unified WLC Model */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1.5 bg-blue-600 rounded-sm shrink-0"></span>
              <span className="text-slate-200 font-bold">WLC Curve (Adjustable)</span>
            </div>
            <div className="pl-5 text-[9px] text-slate-400 space-y-0.5">
              <div className="flex justify-between">
                <span>Persistence (Lp):</span>
                <span className="text-blue-300 font-bold">{params.persistenceLength.toFixed(2)} nm</span>
              </div>
              <div className="flex justify-between">
                <span>Contour (Lc):</span>
                <span className="text-blue-300 font-bold">{params.contourLengthWlc.toFixed(1)} nm</span>
              </div>
              {pickedX !== null && fitResultsWlc && (
                <div className="flex justify-between text-slate-500 border-t border-slate-800/40 pt-0.5 mt-0.5">
                  <span>Fit Chi²:</span>
                  <span className="text-emerald-400 font-bold">{fitResultsWlc.chiSq}</span>
                </div>
              )}
            </div>
          </div>

          {/* Unified FJC Model */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1.5 bg-purple-500 rounded-sm shrink-0"></span>
              <span className="text-slate-200 font-bold">FJC Curve (Adjustable)</span>
            </div>
            <div className="pl-5 text-[9px] text-slate-400 space-y-0.5">
              <div className="flex justify-between">
                <span>Kuhn Length (Lk):</span>
                <span className="text-purple-300 font-bold">{params.kuhnLength.toFixed(2)} nm</span>
              </div>
              <div className="flex justify-between">
                <span>Contour (Lc):</span>
                <span className="text-purple-300 font-bold">{params.contourLengthFjc.toFixed(1)} nm</span>
              </div>
              {pickedX !== null && fitResultsFjc && (
                <div className="flex justify-between text-slate-500 border-t border-slate-800/40 pt-0.5 mt-0.5">
                  <span>Fit Chi²:</span>
                  <span className="text-emerald-400 font-bold">{fitResultsFjc.chiSq}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
