import React, { useState } from 'react';
import { ModelType, ChainParameters, CoordinateShift, FitResults } from '../types';
import { Sliders, Move, RefreshCw, Layers, CheckCircle, Info } from 'lucide-react';

interface SidebarProps {
  modelType: ModelType;
  onModelTypeChange: (type: ModelType) => void;
  params: ChainParameters;
  onParamsChange: (params: ChainParameters) => void;
  coordinateShift: CoordinateShift;
  onCoordinateShiftChange: (shift: CoordinateShift) => void;
  onResetViewport: () => void;
  fitResults: FitResults | null;
  maxX: number;
  hasExperimentalData: boolean;
  pickedX: number | null;
  onClearPickedX: () => void;
  constrainZeroAndPicked: boolean;
  onToggleConstrainZeroAndPicked: (val: boolean) => void;
}

export default function Sidebar({
  modelType,
  onModelTypeChange,
  params,
  onParamsChange,
  coordinateShift,
  onCoordinateShiftChange,
  onResetViewport,
  fitResults,
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
      persistenceLength: val,
      kuhnLength: val * 2.0 // Auto-update Kuhn length
    });
  };

  const handleLkChange = (val: number) => {
    onParamsChange({
      ...params,
      kuhnLength: val,
      persistenceLength: val / 2.0 // Auto-update Persistence length
    });
  };

  const handleLcChange = (val: number) => {
    onParamsChange({
      ...params,
      contourLength: val
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
      {/* Model Selection */}
      <section className="space-y-3">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
          Model Configuration
        </label>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => onModelTypeChange('WLC')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              modelType === 'WLC'
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            WLC Model
          </button>
          <button
            onClick={() => onModelTypeChange('FJC')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              modelType === 'FJC'
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            FJC Model
          </button>
        </div>
      </section>

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

        <div className="space-y-4">
          {/* Persistence Length Slider (editable in WLC, locked/auto in FJC depending on preference) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-600">Persistence Length (Lp)</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleLpChange(Math.max(0.1, parseFloat((params.persistenceLength - adjustStep).toFixed(3))))}
                  disabled={modelType === 'FJC'}
                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none rounded text-[10px] font-bold font-mono transition shadow-sm text-slate-600"
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
                    disabled={modelType === 'FJC'}
                    value={parseFloat(params.persistenceLength.toFixed(3))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) handleLpChange(val);
                    }}
                    className="w-[66px] text-center text-xs font-bold font-mono text-blue-600 bg-white border border-slate-200 rounded py-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-100/50 outline-none disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400"
                    title="Type exact persistence length"
                  />
                  <span className="text-[10px] text-slate-400 font-medium ml-1">nm</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLpChange(Math.min(150, parseFloat((params.persistenceLength + adjustStep).toFixed(3))))}
                  disabled={modelType === 'FJC'}
                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none rounded text-[10px] font-bold font-mono transition shadow-sm text-slate-600"
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
              disabled={modelType === 'FJC'}
              className="slider-track opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            />
            {modelType === 'FJC' && (
              <p className="text-[9px] text-slate-400 italic">Auto-derived for FJC as Lk / 2</p>
            )}
          </div>

          {/* Kuhn Length Slider (editable in FJC, locked/auto in WLC) */}
          <div className="space-y-2 col-span-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-600">Kuhn Length (Lk)</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleLkChange(Math.max(0.2, parseFloat((params.kuhnLength - adjustStep).toFixed(3))))}
                  disabled={modelType === 'WLC'}
                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none rounded text-[10px] font-bold font-mono transition shadow-sm text-slate-600"
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
                    disabled={modelType === 'WLC'}
                    value={parseFloat(params.kuhnLength.toFixed(3))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) handleLkChange(val);
                    }}
                    className="w-[66px] text-center text-xs font-bold font-mono text-blue-600 bg-white border border-slate-200 rounded py-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-100/50 outline-none disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400"
                    title="Type exact Kuhn length"
                  />
                  <span className="text-[10px] text-slate-400 font-medium ml-1">nm</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLkChange(Math.min(300, parseFloat((params.kuhnLength + adjustStep).toFixed(3))))}
                  disabled={modelType === 'WLC'}
                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none rounded text-[10px] font-bold font-mono transition shadow-sm text-slate-600"
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
              disabled={modelType === 'WLC'}
              className="slider-track opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            />
            {modelType === 'WLC' && (
              <p className="text-[9px] text-slate-400 italic font-mono uppercase tracking-wide">
                Auto-calculated (2 × Lp)
              </p>
            )}
          </div>

          {/* Contour Length Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-600">Contour Length (Lc)</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleLcChange(Math.max(10, parseFloat((params.contourLength - adjustStep).toFixed(3))))}
                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded text-[10px] font-bold font-mono transition shadow-sm text-slate-600"
                  title={`Decrease Lc by ${adjustStep} nm`}
                >
                  -{adjustStep}
                </button>
                <div className="flex items-center">
                  <input
                    type="number"
                    step="0.05"
                    min={Math.max(10, Math.floor(minLc))}
                    max={Math.max(2000, Math.ceil(maxLc))}
                    value={parseFloat(params.contourLength.toFixed(3))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) handleLcChange(val);
                    }}
                    className="w-[66px] text-center text-xs font-bold font-mono text-blue-600 bg-white border border-slate-200 rounded py-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-100/50 outline-none"
                    title="Type exact contour length"
                  />
                  <span className="text-[10px] text-slate-400 font-medium ml-1">nm</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLcChange(Math.min(2000, parseFloat((params.contourLength + adjustStep).toFixed(3))))}
                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded text-[10px] font-bold font-mono transition shadow-sm text-slate-600"
                  title={`Increase Lc by ${adjustStep} nm`}
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
              value={params.contourLength}
              onChange={(e) => handleLcChange(parseFloat(e.target.value))}
              className="slider-track cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>Min: {Math.max(10, Math.floor(minLc))} nm</span>
              <span>Max: {Math.max(2000, Math.ceil(maxLc))} nm</span>
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
        <section className="bg-blue-50/60 rounded-xl p-4 border border-blue-100/50 space-y-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={14} className="text-blue-500 shrink-0" />
            <h4 className="text-xs font-bold text-blue-900">Active Fit Range</h4>
          </div>
          <div className="space-y-1.5 text-xs text-blue-950 font-medium font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500 text-[10px]">Fit bound:</span>
              <span>0 to {pickedX.toFixed(1)} nm</span>
            </div>
            {fitResults && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-[10px]">Points:</span>
                  <span>{fitResults.fittedPointsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-[10px]">Chi-Sq Residual:</span>
                  <span>{fitResults.chiSq}</span>
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClearPickedX}
            className="w-full mt-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold rounded transition-colors"
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
