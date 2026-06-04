import React, { useRef } from 'react';
import { Upload, ChevronRight, CheckCircle2 } from 'lucide-react';
import { JpkSegment } from '../types';

interface HeaderProps {
  currentFileName: string;
  isSampleData: boolean;
  segments: JpkSegment[];
  activeSegmentIndex: number;
  onSegmentChange: (index: number) => void;
  onFileUpload: (fileName: string, content: string) => void;
  onLoadSampleData: () => void;
}

export default function Header({
  currentFileName,
  isSampleData,
  segments,
  activeSegmentIndex,
  onSegmentChange,
  onFileUpload,
  onLoadSampleData,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      onFileUpload(file.name, text);
    };
    reader.readAsText(file);
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10" id="app-header">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-sm">P</div>
        <div className="flex flex-col">
          <h1 className="text-sm md:text-base font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
            PolymerFit <span className="text-slate-400 font-normal text-xs underline decoration-slate-300">v4.2.0</span>
          </h1>
          <span className="text-[10px] text-slate-400 font-medium">AFM Single-Molecule Force Spectroscopy</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Active segment selector if the file has multiple segments */}
        {segments.length > 1 && (
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Segment:</span>
            <select
              value={activeSegmentIndex}
              onChange={(e) => onSegmentChange(Number(e.target.value))}
              className="text-xs border border-slate-200 bg-white px-2 py-1 rounded outline-none font-medium cursor-pointer text-slate-700 hover:border-slate-300 transition-colors"
            >
              {segments.map((seg, idx) => (
                <option key={idx} value={idx}>
                  {seg.name} ({seg.points.length} pts)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Data Status Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
          isSampleData
            ? 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 cursor-pointer'
            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
        }`}
          onClick={isSampleData ? undefined : onLoadSampleData}
          title={isSampleData ? "Click to upload your own AFM data" : "Click to restore built-in mock data"}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isSampleData ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`}></span>
          <span className="max-w-[130px] md:max-w-[200px] truncate">
            {isSampleData ? 'Mock Polymer Loaded' : currentFileName}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2">
          {(!isSampleData) && (
            <button
              onClick={onLoadSampleData}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition-all"
              title="Load simulation data"
            >
              Load Demo
            </button>
          )}
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-1.5 bg-slate-900 border border-slate-800 text-white text-xs font-medium rounded hover:bg-slate-800 flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Upload size={13} />
            <span>Import JPK txt</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.csv,.asc,.dat"
            className="hidden"
          />
        </div>
      </div>
    </header>
  );
}
