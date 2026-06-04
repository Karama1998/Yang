import React, { useState } from 'react';
import { ModelType, ChainParameters, CoordinateShift, FitResults } from '../types';
import { Sliders, Move, RefreshCw, Layers, CheckCircle, Info } from 'lucide-react';

interface SidebarProps {
  params: ChainParameters;
  onParamsChange: (params: ChainParameters) => void;
  coordinateShift: CoordinateShift;
  onCoordinateShiftChange: (shift: CoordinateShift) => void;
  onResetViewport: () => void;
  fitResultsWlc: FitResults | null;
  fitResultsFjc: FitResults | null;
  maxX: number;
  hasExperimentalData: boolean;
  pickedX: number | null;
  onClearPickedX: () => void;
  constrainZeroAndPicked: boolean;
  onToggleConstrainZeroAndPicked: (val: boolean) => void;
}

export default function Sidebar({
  params,
  onParamsChange,
  coordinateShift,
  onCoordinateShiftChange,
  onResetViewport,
  fitResultsWlc,
  fitResultsFjc,
  maxX,
  hasExperimentalData,
  pickedX,
  onClearPickedX,
  constrainZeroAndPicked,
  onToggleConstrainZeroAndPicked,
}: SidebarProps) {

  // Dynamic ranges based on experimental data contour
  const minLc = Math.max(10, Math.ceil(maxX * 0.5));
  const maxLc = Math.max(2000, Math.ceil(maxX * 3.5));

  const [adjustStep, setAdjustStep] = useState<number>(0.1);

  const handleLpChange = (val: number) => {
    onParamsChange({
      ...params,
      persistenceLength: val
    });
  };

  const handleLkChange = (val: number) => {
    onParamsChange({
      ...params,
      kuhnLength: val
    });
  };

  const handleLcWlcChange = (val: number) => {
    onParamsChange({
      ...params,
      contourLengthWlc: val
    });
  };

  const handleLcFjcChange = (val: number) => {
    onParamsChange({
      ...params,
      contourLengthFjc: val
    });
  };

  const adjustOffset = (axis: 'x' | 'y', step: number) => {
    if (axis === 'x') {
      const newVal = parseFloat((coordinateShift.xOffset + step).toFixed(2));
      onCoordinateShiftChange({ ...coordinateShift, xOffset: newVal });
    } else {
      const newVal = parseFloat((coordinateShift.yOffset + step).toFixed(2));
      onCoordinateShiftChange({ ...coordinateShift, yOffset: newVal });
    }
  };

  const handleOffsetInputChange = (axis: 'x' | 'y', val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    if (axis === 'x') {
      onCoordinateShiftChange({ ...coordinateShift, xOffset: num });
    } else {
      onCoordinateShiftChange({ ...coordinateShift, yOffset: num });
    }
  };

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 p-5 space-y-6 overflow-y-auto" id="app-sidebar">

      {/* Fitting Constraints */}
      <section className="space-y-2 pt-1">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
          Fitting Constraints
        </label>
        <label className="flex items-start gap-2.5 p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-50/70 hover:border-blue-200 transition select-none">
          <input
            type="checkbox"
            checked={constrainZeroAndPicked}
            onChange={(e) => onToggleConstrainZeroAndPicked(e.target.checked)}
            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5 border-slate-300"
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800">Two-Point Anchor Fit</span>
            <span className="text-[10px] text-slate-500 leading-normal mt-1 font-medium">
              Forces curves to pass exactly through the origin <code className="font-mono text-blue-600 bg-blue-100/50 px-1 rounded">(0,0)</code> and the select/picked point.
            </span>
          </div>
        </label>
      </section>

      {/* Sliders Block */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Chain Parameters
          </label>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-2 py-1 rounded-lg shadow-inner-sm">
            <span className="text-[9px] text-slate-400 font-extrabold tracking-wide uppercase">Step:</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="500"
              value={adjustStep}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) setAdjustStep(val);
              }}
              className="w-12 text-center text-[10px] font-bold font-mono bg-white border border-slate-200 rounded px-1 text-slate-700 outline-none focus:border-blue-300"
              title="Enter custom step magnitude"
            />
            <span className="text-[9px] text-slate-400 font-bold font-mono">nm</span>
          </div>
        </div>

        {/* Step size quick presets */}
        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-[9px] text-slate-400 font-medium">Presets:</span>
          {[0.1, 0.5, 1.0, 5.0, 10.0].map((preset) => (
            <button
              key={`preset-${preset}`}
              type="button"
              onClick={() => setAdjustStep(preset)}
              className={`px-1.5 py-0.5 text-[9px] font-bold font-mono rounded border transition ${
                Math.abs(adjustStep - preset) < 0.001
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {/* WLC Model Controls */}
          <div className="bg-blue-50/25 p-3 rounded-xl border border-blue-100/50 space-y-4">
            <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
              WLC Model Parameters
            </span>

            {/* WLC Scientific Formula */}
            <div className="bg-white/80 border border-blue-100/60 rounded-lg p-2.5 space-y-1">
              <span className="text-[9px] font-bold text-blue-800 uppercase tracking-wider block">Marko-Siggia WLC Formula</span>
              <div className="flex items-center justify-center gap-[3px] font-serif text-slate-800 text-[11px] bg-slate-50/50 py-2.5 px-1 rounded border border-slate-150/80 my-1 overflow-x-auto">
                <span className="font-bold">F(x)</span>
                <span>=</span>
                <div className="flex flex-col items-center">
                  <span className="border-b border-slate-400 px-1 leading-none pb-0.5 text-[10px]">k<sub>B</sub>T</span>
                  <span className="leading-none pt-0.5 text-[10px]">L<sub>p</sub></span>
                </div>
                <span className="text-[14px] font-bold leading-none">·</span>
                <span>[</span>
                <div className="flex flex-col items-center">
                  <span className="border-b border-slate-400 px-1 leading-none pb-0.5 text-[10px]">1</span>
                  <span className="leading-none pt-0.5 text-[10px]">4(1 - x/L<sub>c</sub>)<sup>2</sup></span>
                </div>
                <span>-</span>
                <div className="flex flex-col items-center">
                  <span className="border-b border-slate-400 px-1 leading-none pb-0.5 text-[10px]">1</span>
                  <span className="leading-none pt-0.5 text-[10px]">4</span>
                </div>
                <span>+</span>
                <div className="flex flex-col items-center">
                  <span className="border-b border-slate-400 px-1 leading-none pb-0.5 text-[10px]">x</span>
                  <span className="leading-none pt-0.5 text-[10px]">L<sub>c</sub></span>
                </div>
                <span>]</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">
                Where <span className="font-serif italic font-medium">k<sub>B</sub>T ≈ 4.114 pN·nm</span> (thermal energy), <span className="font-serif italic font-medium font-mono">L<sub>p</sub></span> is persistence, and <span className="font-serif italic font-medium font-mono">L<sub>c</sub></span> is contour.
              </p>
            </div>

            {/* Persistence Length Slider (coupled dynamically with Kuhn Length) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-650 font-medium">Persistence (Lp)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleLpChange(Math.max(0.1, parseFloat((params.persistenceLength - adjustStep).toFixed(3))))}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none rounded text-[9px] font-bold font-mono transition shadow-sm text-slate-600"
                    title={`Decrease Lp by ${adjustStep} nm`}
                  >
                    -{adjustStep}
                  </button>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="150"
                      value={parseFloat(params.persistenceLength.toFixed(3))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handleLpChange(val);
                      }}
                      className="w-[62px] text-center text-xs font-bold font-mono text-blue-600 bg-white border border-slate-200 rounded py-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-100/50 outline-none"
                      title="Type exact persistence length"
                    />
                    <span className="text-[10px] text-slate-400 font-medium ml-1">nm</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLpChange(Math.min(150, parseFloat((params.persistenceLength + adjustStep).toFixed(3))))}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none rounded text-[9px] font-bold font-mono transition shadow-sm text-slate-600"
                    title={`Increase Lp by ${adjustStep} nm`}
                  >
                    +{adjustStep}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0.1"
                max="150"
                step="0.1"
                value={params.persistenceLength}
                onChange={(e) => handleLpChange(parseFloat(e.target.value))}
                className="slider-track opacity-90 cursor-pointer"
              />
            </div>

            {/* WLC Contour Length Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-655 font-medium">Contour (Lc) [WLC]</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleLcWlcChange(Math.max(10, parseFloat((params.contourLengthWlc - adjustStep).toFixed(3))))}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[9px] font-bold font-mono transition shadow-sm text-slate-600"
                    title={`Decrease Lc_WLC by ${adjustStep} nm`}
                  >
                    -{adjustStep}
                  </button>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.05"
                      min={Math.max(10, Math.floor(minLc))}
                      max={Math.max(2000, Math.ceil(maxLc))}
                      value={parseFloat(params.contourLengthWlc.toFixed(3))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handleLcWlcChange(val);
                      }}
                      className="w-[62px] text-center text-xs font-bold font-mono text-blue-600 bg-white border border-slate-200 rounded py-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-100/50 outline-none"
                      title="Type exact contour length for WLC"
                    />
                    <span className="text-[10px] text-slate-400 font-medium ml-1">nm</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLcWlcChange(Math.min(2000, parseFloat((params.contourLengthWlc + adjustStep).toFixed(3))))}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[9px] font-bold font-mono transition shadow-sm text-slate-600"
                    title={`Increase Lc_WLC by ${adjustStep} nm`}
                  >
                    +{adjustStep}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={Math.max(10, Math.floor(minLc))}
                max={Math.max(2000, Math.ceil(maxLc))}
                step="0.5"
                value={params.contourLengthWlc}
                onChange={(e) => handleLcWlcChange(parseFloat(e.target.value))}
                className="slider-track cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>Min: {Math.max(10, Math.floor(minLc))}</span>
                <span>Max: {Math.max(2000, Math.ceil(maxLc))} nm</span>
              </div>
            </div>
          </div>

          {/* FJC Model Controls */}
          <div className="bg-purple-50/25 p-3 rounded-xl border border-purple-100/50 space-y-4">
            <span className="text-[10px] uppercase font-bold text-purple-700 block tracking-wider">
              FJC Model Parameters
            </span>

            {/* FJC Scientific Formula */}
            <div className="bg-white/80 border border-purple-100/60 rounded-lg p-2.5 space-y-1">
              <span className="text-[9px] font-bold text-purple-800 uppercase tracking-wider block">Langevin FJC Formula</span>
              <div className="flex items-center justify-center gap-[3px] font-serif text-slate-800 text-[11px] bg-slate-50/50 py-2.5 px-1 rounded border border-slate-150/80 my-1 overflow-x-auto">
                <span className="font-bold">x(F)</span>
                <span>=</span>
                <span>L<sub>c</sub></span>
                <span className="text-[14px] font-bold leading-none">·</span>
                <span className="italic font-bold">L</span>
                <span>(</span>
                <div className="flex flex-col items-center">
                  <span className="border-b border-slate-400 px-1 leading-none pb-0.5 text-[10px]">F · L<sub>k</sub></span>
                  <span className="leading-none pt-0.5 text-[10px]">k<sub>B</sub>T</span>
                </div>
                <span>)</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">
                Where <span className="font-serif italic font-medium">L(z) = coth(z) - 1/z</span> (Langevin function), <span className="font-serif italic font-medium font-mono">L<sub>k</sub></span> is Kuhn length, and <span className="font-serif italic font-medium font-mono">L<sub>c</sub></span> is contour.
              </p>
            </div>

            {/* Kuhn Length Slider (coupled dynamically with Persistence Length) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-650 font-medium">Kuhn Length (Lk)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleLkChange(Math.max(0.2, parseFloat((params.kuhnLength - adjustStep).toFixed(3))))}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none rounded text-[9px] font-bold font-mono transition shadow-sm text-slate-600"
                    title={`Decrease Lk by ${adjustStep} nm`}
                  >
                    -{adjustStep}
                  </button>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0.2"
                      max="300"
                      value={parseFloat(params.kuhnLength.toFixed(3))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handleLkChange(val);
                      }}
                      className="w-[62px] text-center text-xs font-bold font-mono text-purple-600 bg-white border border-slate-200 rounded py-0.5 focus:border-purple-400 focus:ring-1 focus:ring-purple-100/50 outline-none"
                      title="Type exact Kuhn length"
                    />
                    <span className="text-[10px] text-slate-400 font-medium ml-1">nm</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLkChange(Math.min(300, parseFloat((params.kuhnLength + adjustStep).toFixed(3))))}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none rounded text-[9px] font-bold font-mono transition shadow-sm text-slate-600"
                    title={`Increase Lk by ${adjustStep} nm`}
                  >
                    +{adjustStep}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0.2"
                max="300"
                step="0.2"
                value={params.kuhnLength}
                onChange={(e) => handleLkChange(parseFloat(e.target.value))}
                className="slider-track opacity-90 cursor-pointer"
              />
            </div>

            {/* FJC Contour Length Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-655 font-medium">Contour (Lc) [FJC]</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleLcFjcChange(Math.max(10, parseFloat((params.contourLengthFjc - adjustStep).toFixed(3))))}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[9px] font-bold font-mono transition shadow-sm text-slate-600"
                    title={`Decrease Lc_FJC by ${adjustStep} nm`}
                  >
                    -{adjustStep}
                  </button>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.05"
                      min={Math.max(10, Math.floor(minLc))}
                      max={Math.max(2000, Math.ceil(maxLc))}
                      value={parseFloat(params.contourLengthFjc.toFixed(3))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) handleLcFjcChange(val);
                      }}
                      className="w-[62px] text-center text-xs font-bold font-mono text-purple-600 bg-white border border-slate-200 rounded py-0.5 focus:border-purple-400 focus:ring-1 focus:ring-purple-100/50 outline-none"
                      title="Type exact contour length for FJC"
                    />
                    <span className="text-[10px] text-slate-400 font-medium ml-1">nm</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLcFjcChange(Math.min(2000, parseFloat((params.contourLengthFjc + adjustStep).toFixed(3))))}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[9px] font-bold font-mono transition shadow-sm text-slate-600"
                    title={`Increase Lc_FJC by ${adjustStep} nm`}
                  >
                    +{adjustStep}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={Math.max(10, Math.floor(minLc))}
                max={Math.max(2000, Math.ceil(maxLc))}
                step="0.5"
                value={params.contourLengthFjc}
                onChange={(e) => handleLcFjcChange(parseFloat(e.target.value))}
                className="slider-track cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>Min: {Math.max(10, Math.floor(minLc))}</span>
                <span>Max: {Math.max(2000, Math.ceil(maxLc))} nm</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coordinate shifts */}
      <section className="pt-4 border-t border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Coordinate Shift
          </label>
          <Move size={12} className="text-slate-400" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* X Shift */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium">X-Offset (nm)</span>
            <div className="flex h-8 border border-slate-200 rounded-md overflow-hidden bg-slate-50">
              <button
                onClick={() => adjustOffset('x', -1)}
                className="w-8 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-r border-slate-200 text-xs font-bold transition-all"
                title="Subtract 1.0 nm"
              >
                -
              </button>
              <input
                type="number"
                step="0.1"
                onChange={(e) => handleOffsetInputChange('x', e.target.value)}
                value={coordinateShift.xOffset}
                className="w-12 text-center text-xs outline-none font-mono bg-white flex-1"
              />
              <button
                onClick={() => adjustOffset('x', 1)}
                className="w-8 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-l border-slate-200 text-xs font-bold transition-all"
                title="Add 1.0 nm"
              >
                +
              </button>
            </div>
          </div>

          {/* Y Shift */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium">Y-Offset (pN)</span>
            <div className="flex h-8 border border-slate-200 rounded-md overflow-hidden bg-slate-50">
              <button
                onClick={() => adjustOffset('y', -5)}
                className="w-8 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-r border-slate-200 text-xs font-bold transition-all"
                title="Subtract 5.0 pN"
              >
                -
              </button>
              <input
                type="number"
                step="0.5"
                onChange={(e) => handleOffsetInputChange('y', e.target.value)}
                value={coordinateShift.yOffset}
                className="w-12 text-center text-xs outline-none font-mono bg-white flex-1"
              />
              <button
                onClick={() => adjustOffset('y', 5)}
                className="w-8 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-l border-slate-200 text-xs font-bold transition-all"
                title="Add 5.0 pN"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="pt-1 flex flex-col gap-1.5">
          <span className="text-[10px] text-slate-500 font-medium">Axis Orientation</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onCoordinateShiftChange({
                ...coordinateShift,
                invertX: !coordinateShift.invertX
              })}
              className={`py-1 font-bold text-[11px] rounded border transition-all ${
                coordinateShift.invertX
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title="Reverse the X (Extension) axis coordinates"
            >
              {coordinateShift.invertX ? '✓ Reversed X' : 'Invert X'}
            </button>
            <button
              onClick={() => onCoordinateShiftChange({
                ...coordinateShift,
                invertY: !coordinateShift.invertY
              })}
              className={`py-1 font-bold text-[11px] rounded border transition-all ${
                coordinateShift.invertY
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title="Reverse the Y (Force) axis coordinates (flip tension/adhesion direction)"
            >
              {coordinateShift.invertY ? '✓ Reversed Y' : 'Invert Y'}
            </button>
          </div>
        </div>

        {hasExperimentalData && (
          <p className="text-[9px] text-slate-400 leading-normal">
            Use orientation flips and offset shifts to align the contact point at x=0 and pull force upward (positive) before picking a fit region.
          </p>
        )}
      </section>

      {/* Real-time fitting status report */}
      {pickedX !== null && (
        <section className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/85 space-y-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={14} className="text-emerald-500 shrink-0" />
            <h4 className="text-xs font-bold text-slate-800">Fitting Results Comparison</h4>
          </div>
          
          <div className="flex justify-between text-xs font-mono font-medium border-b border-slate-100 pb-1.5">
            <span className="text-slate-500 text-[10px]">Fit Bound:</span>
            <span>0 to {pickedX.toFixed(1)} nm</span>
          </div>

          <div className="flex flex-col gap-2.5 text-[10px] font-mono leading-relaxed">
            {/* WLC Column */}
            <div className="bg-blue-50/60 rounded-lg p-2.5 border border-blue-100/50 space-y-1">
              <span className="font-sans font-bold text-blue-800 block text-[9.5px] border-b border-blue-100 pb-0.5">WLC Model Fit</span>
              {fitResultsWlc ? (
                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  <div><span className="text-slate-400 text-[9px]">Lp:</span> <span className="font-bold text-blue-900">{fitResultsWlc.lp.toFixed(2)} nm</span></div>
                  <div><span className="text-slate-400 text-[9px]">Lc:</span> <span className="font-bold text-slate-700">{fitResultsWlc.lc.toFixed(1)} nm</span></div>
                  <div><span className="text-slate-400 text-[9px]">Chi²:</span> <span className="font-bold text-emerald-700">{fitResultsWlc.chiSq}</span></div>
                </div>
              ) : (
                <span className="text-slate-400 italic block text-[9px]">unfit</span>
              )}
            </div>

            {/* FJC Column */}
            <div className="bg-purple-50/60 rounded-lg p-2.5 border border-purple-100/50 space-y-1">
              <span className="font-sans font-bold text-purple-800 block text-[9.5px] border-b border-purple-100 pb-0.5">FJC Model Fit</span>
              {fitResultsFjc ? (
                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  <div><span className="text-slate-400 text-[9px]">Lk:</span> <span className="font-bold text-purple-900">{fitResultsFjc.lk.toFixed(2)} nm</span></div>
                  <div><span className="text-slate-400 text-[9px]">Lc:</span> <span className="font-bold text-slate-700">{fitResultsFjc.lc.toFixed(1)} nm</span></div>
                  <div><span className="text-slate-400 text-[9px]">Chi²:</span> <span className="font-bold text-emerald-700">{fitResultsFjc.chiSq}</span></div>
                </div>
              ) : (
                <span className="text-slate-400 italic block text-[9px]">unfit</span>
              )}
            </div>
          </div>

          <button
            onClick={onClearPickedX}
            className="w-full mt-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded transition-colors border border-slate-200 shadow-inner-sm"
          >
            Clear Selected Range
          </button>
        </section>
      )}

      {/* Reset viewport container bottom element */}
      <div className="mt-auto pt-4 flex flex-col gap-2">
        <button
          onClick={onResetViewport}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
        >
          <RefreshCw size={13} />
          <span>Reset Display Viewport</span>
        </button>
      </div>
    </aside>
  );
}
