import React from 'react';
import { ModelType, ChainParameters, FitResults } from '../types';
import { Download, Compass } from 'lucide-react';

interface FooterProps {
  cursorX: number | null;
  cursorY: number | null;
  modelType: ModelType;
  params: ChainParameters;
  fitResults: FitResults | null;
  onPerformGlobalFit: () => void;
  onExportCsv: () => void;
  hasPoints: boolean;
}

export default function Footer({
  cursorX,
  cursorY,
  modelType,
  params,
  fitResults,
  onPerformGlobalFit,
  onExportCsv,
  hasPoints,
}: FooterProps) {
  return (
    <footer className="h-16 bg-slate-900 border-t border-slate-800 shrink-0 px-6 flex items-center justify-between text-white z-10 font-sans" id="app-footer">
      {/* Telemetry readouts */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Active Cursor</span>
          <span className="text-xs font-mono text-emerald-400">
            {cursorX !== null && cursorY !== null
              ? `X: ${cursorX.toFixed(2)} nm | Y: ${cursorY.toFixed(2)} pN`
              : 'X: (offline) | Y: (offline)'}
          </span>
        </div>
        
        <div className="h-8 w-px bg-slate-700 hidden sm:block"></div>
        
        <div className="flex flex-col hidden sm:flex">
          <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Model Parameters</span>
          <span className="text-xs font-mono text-blue-400">
            {modelType === 'WLC' 
              ? `Lp: ${params.persistenceLength.toFixed(2)} nm | Lc: ${params.contourLength.toFixed(1)} nm`
              : `Lk: ${params.kuhnLength.toFixed(2)} nm | Lc: ${params.contourLength.toFixed(1)} nm`}
          </span>
        </div>

        {fitResults && (
          <>
            <div className="h-8 w-px bg-slate-700 hidden md:block"></div>
            <div className="flex flex-col hidden md:flex">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Fitting Results</span>
              <span className="text-xs font-mono text-emerald-300">
                Lp: {fitResults.lp.toFixed(2)} nm | Lc: {fitResults.lc.toFixed(1)} nm | Chi²: {fitResults.chiSq}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Controller Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onExportCsv}
          disabled={!hasPoints}
          className="px-4 py-2 border border-slate-700 rounded-md text-xs font-bold hover:bg-slate-800 hover:text-white flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Download aligned data & fitted model as CSV file"
        >
          <Download size={13} />
          <span className="hidden xs:inline">Export Fitting Results</span>
          <span className="xs:hidden">Export</span>
        </button>
        <button
          onClick={onPerformGlobalFit}
          disabled={!hasPoints}
          className="px-6 py-2 bg-blue-500 text-white rounded-md text-xs font-bold hover:bg-blue-600 flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-blue-950/20 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Perform an automated mathematical curve fit over the entire visible data scope"
        >
          <Compass size={13} />
          <span>Perform Global Fit</span>
        </button>
      </div>
    </footer>
  );
}
