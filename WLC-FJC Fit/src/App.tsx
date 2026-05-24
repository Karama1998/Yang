import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ModelType, ChainParameters, CoordinateShift, DataPoint, JpkSegment } from './types';
import { parseJpkFile, generateMockJpkRetractFile } from './utils/jpkParser';
import {
  fitWlcModel,
  fitFjcModel,
  getConstrainedLp,
  getConstrainedLcWlc,
  getConstrainedLcFjc,
  getConstrainedLkFjc
} from './utils/polymerFit';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import GraphArea from './components/GraphArea';
import Footer from './components/Footer';

export default function App() {
  // Model Settings
  const [modelType, setModelType] = useState<ModelType>('WLC');
  const [params, setParams] = useState<ChainParameters>({
    persistenceLength: 0.5, // nm (standard persistence length is ~0.4 - 0.5 for ssDNA/PEG)
    kuhnLength: 1.0,        // nm
    contourLength: 350.0,   // nm
  });

  // Shifts
  const [coordinateShift, setCoordinateShift] = useState<CoordinateShift>({
    xOffset: 0.0,
    yOffset: 0.0,
    invertX: false,
    invertY: false,
  });

  // JPK Curves State
  const [segments, setSegments] = useState<JpkSegment[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  const [rawPoints, setRawPoints] = useState<DataPoint[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string>('mock_retract_profile.txt');
  const [isSampleData, setIsSampleData] = useState<boolean>(true);

  // Viewport Settings
  const [viewport, setViewport] = useState({
    xMin: -20,
    xMax: 400,
    yMin: -30,
    yMax: 250,
  });

  // Interactive points picking limits
  const [pickedX, setPickedX] = useState<number | null>(null);
  const [isPickingMode, setIsPickingMode] = useState<boolean>(false);
  const [constrainZeroAndPicked, setConstrainZeroAndPicked] = useState<boolean>(true);

  // Dynamic Hover Coordinate Telemetry
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [cursorY, setCursorY] = useState<number | null>(null);

  // 1. Recalculate shifted coordinates when rawPoints or offsets change
  const activePoints = useMemo(() => {
    return rawPoints.map(p => {
      const px = coordinateShift.invertX ? -p.x : p.x;
      const py = coordinateShift.invertY ? -p.y : p.y;
      return {
        ...p,
        x: px + coordinateShift.xOffset,
        y: py + coordinateShift.yOffset,
      };
    });
  }, [rawPoints, coordinateShift]);

  // 2. Perform global fitting up to pickedX
  const fitResults = useMemo(() => {
    if (pickedX === null || activePoints.length === 0) return null;
    if (modelType === 'WLC') {
      return fitWlcModel(activePoints, pickedX, constrainZeroAndPicked);
    } else {
      return fitFjcModel(activePoints, pickedX, constrainZeroAndPicked);
    }
  }, [activePoints, pickedX, modelType, constrainZeroAndPicked]);

  // 3. Update sliders whenever the user picks a fit boundary and a fit completes
  useEffect(() => {
    if (fitResults && fitResults.fittedPointsCount > 0) {
      setParams({
        persistenceLength: fitResults.lp,
        kuhnLength: fitResults.lk,
        contourLength: fitResults.lc,
      });
    }
  }, [fitResults]);

  // Find exact experimental data point closest to clicked boundary pickedX
  const pickedPoint = useMemo(() => {
    if (pickedX === null || activePoints.length === 0) return null;
    const fPoints = activePoints.filter(p => p.x > 0 && p.x <= pickedX && p.y > 0);
    if (fPoints.length === 0) return null;
    
    let bestP = fPoints[0];
    let minDiff = Math.abs(bestP.x - pickedX);
    for (const p of fPoints) {
      const diff = Math.abs(p.x - pickedX);
      if (diff < minDiff) {
        minDiff = diff;
        bestP = p;
      }
    }
    return bestP;
  }, [activePoints, pickedX]);

  // Handle parameter modifications while preserving origin + picked-point anchor constraints
  const handleParamsChange = useCallback((newParams: ChainParameters) => {
    if (!constrainZeroAndPicked || !pickedPoint) {
      setParams(newParams);
      return;
    }

    const xp = pickedPoint.x;
    const yp = pickedPoint.y;

    if (modelType === 'WLC') {
      const lcChanged = Math.abs(newParams.contourLength - params.contourLength) > 1e-4;
      const lpChanged = Math.abs(newParams.persistenceLength - params.persistenceLength) > 1e-4;

      if (lcChanged) {
        const lc = Math.max(xp * 1.002, newParams.contourLength);
        const lp = getConstrainedLp(lc, xp, yp);
        setParams({
          contourLength: lc,
          persistenceLength: lp,
          kuhnLength: lp * 2.0
        });
      } else if (lpChanged) {
        const lp = Math.max(0.01, newParams.persistenceLength);
        const lc = getConstrainedLcWlc(lp, xp, yp);
        setParams({
          contourLength: lc,
          persistenceLength: lp,
          kuhnLength: lp * 2.0
        });
      } else {
        setParams(newParams);
      }
    } else {
      const lcChanged = Math.abs(newParams.contourLength - params.contourLength) > 1e-4;
      const lkChanged = Math.abs(newParams.kuhnLength - params.kuhnLength) > 1e-4;

      if (lcChanged) {
        const lc = Math.max(xp * 1.002, newParams.contourLength);
        const lk = getConstrainedLkFjc(lc, xp, yp);
        setParams({
          contourLength: lc,
          kuhnLength: lk,
          persistenceLength: lk / 2.0
        });
      } else if (lkChanged) {
        const lk = Math.max(0.01, newParams.kuhnLength);
        const lc = getConstrainedLcFjc(lk, xp, yp);
        setParams({
          contourLength: lc,
          kuhnLength: lk,
          persistenceLength: lk / 2.0
        });
      } else {
        setParams(newParams);
      }
    }
  }, [constrainZeroAndPicked, pickedPoint, modelType, params]);

  // Helper to adjust viewport based on dataset bounds
  const handleAutoFitViewport = useCallback((pts: DataPoint[]) => {
    if (pts.length === 0) return;
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = maxX - minX || 50;
    const spanY = maxY - minY || 50;

    setViewport({
      xMin: parseFloat((minX - spanX * 0.1).toFixed(1)),
      xMax: parseFloat((maxX + spanX * 0.15).toFixed(1)),
      yMin: parseFloat((minY - spanY * 0.15).toFixed(1)),
      yMax: parseFloat((maxY + spanY * 0.15).toFixed(1)),
    });

    // Estimate suitable initial contour length
    const guessedLc = parseFloat((maxX * 1.05).toFixed(1));
    setParams(prev => ({
      ...prev,
      contourLength: guessedLc,
      // Keep other values or set reasonable physical defaults
      persistenceLength: prev.persistenceLength > 0 ? prev.persistenceLength : 0.5,
      kuhnLength: prev.kuhnLength > 0 ? prev.kuhnLength : 1.0,
    }));
  }, []);

  // 4. Initial Load: Populate with mock retract polymer curves on mount
  const handleLoadSampleData = useCallback(() => {
    const fileContent = generateMockJpkRetractFile();
    const parsedSegments = parseJpkFile(fileContent);

    // Filter to automatically select 'retract' segment first
    let selectedIdx = parsedSegments.findIndex(s => s.name.toLowerCase().includes('retract'));
    if (selectedIdx === -1) selectedIdx = 0;

    setSegments(parsedSegments);
    setActiveSegmentIndex(selectedIdx);
    
    // Maintain a base unshifted set of points
    const pts = parsedSegments[selectedIdx]?.points || [];
    setRawPoints(pts);

    setCoordinateShift({ xOffset: 0.0, yOffset: 0.0, invertX: false, invertY: false });
    setPickedX(null);
    setCurrentFileName('JPK_Retract_Model.txt');
    setIsSampleData(true);

    // Fit visual viewport bounds
    handleAutoFitViewport(pts);
  }, [handleAutoFitViewport]);

  useEffect(() => {
    handleLoadSampleData();
  }, [handleLoadSampleData]);

  // Handler for custom file imports
  const handleFileUpload = (fileName: string, content: string) => {
    const parsedSegments = parseJpkFile(content);
    if (parsedSegments.length === 0 || parsedSegments[0].points.length === 0) {
      alert("Uh oh! Could not find readable force spectroscopy coordinate columns in this file. Please verify it's a standard ASCII export.");
      return;
    }

    // Attempt to auto-detect retract segment
    let retractIdx = parsedSegments.findIndex(s => s.name.toLowerCase().includes('retract'));
    if (retractIdx === -1) {
      // Find segment with most points, typically retract is large
      let maxPts = -1;
      parsedSegments.forEach((seg, i) => {
        if (seg.points.length > maxPts) {
          maxPts = seg.points.length;
          retractIdx = i;
        }
      });
    }

    setSegments(parsedSegments);
    setActiveSegmentIndex(retractIdx);
    
    const targetPoints = parsedSegments[retractIdx]?.points || [];
    setRawPoints(targetPoints);

    // Auto-detect negative force trends and automatically invert if needed
    let isNegY = false;
    if (targetPoints.length > 0) {
      const avgY = targetPoints.reduce((sum, curr) => sum + curr.y, 0) / targetPoints.length;
      if (avgY < 0) {
        isNegY = true;
      }
    }

    setCoordinateShift({
      xOffset: 0.0,
      yOffset: 0.0,
      invertX: false,
      invertY: isNegY,
    });
    setPickedX(null);
    setCurrentFileName(fileName);
    setIsSampleData(false);

    // Call fit bounds automatically
    handleAutoFitViewport(targetPoints);
  };

  const handleSegmentChange = (idx: number) => {
    if (idx < 0 || idx >= segments.length) return;
    setActiveSegmentIndex(idx);
    const targetPoints = segments[idx].points;
    setRawPoints(targetPoints);
    setPickedX(null);
    handleAutoFitViewport(targetPoints);
  };

  // Perform full-series automatic fit
  const handlePerformGlobalFit = () => {
    if (activePoints.length === 0) return;
    
    // Choose fitting barrier at 95% of the rightmost physical data
    const maxX = Math.max(...activePoints.map(p => p.x));
    const suggestedPickedX = maxX * 0.95;
    
    setPickedX(suggestedPickedX);

    const fitVal = modelType === 'WLC'
      ? fitWlcModel(activePoints, suggestedPickedX, constrainZeroAndPicked)
      : fitFjcModel(activePoints, suggestedPickedX, constrainZeroAndPicked);

    if (fitVal && fitVal.fittedPointsCount > 0) {
      setParams({
        persistenceLength: fitVal.lp,
        kuhnLength: fitVal.lk,
        contourLength: fitVal.lc,
      });
    }
  };

  // Export spreadsheet curves as CSV file
  const handleExportCsv = () => {
    if (activePoints.length === 0) return;

    let csv = '';
    if (modelType === 'WLC') {
      csv = 'Index,Raw_Extension_m,Raw_Force_N,Aligned_Extension_nm,Aligned_Force_pN,Siggia_WLC_Model_Force_pN,Residual_pN\n';
    } else {
      csv = 'Index,Raw_Extension_m,Raw_Force_N,Aligned_Extension_nm,Aligned_Force_pN,Langevin_FJC_Model_Extension_nm,Residual_nm\n';
    }

    const rows = activePoints.map(p => {
      let theoretical = 0.0;
      let error = 0.0;

      if (modelType === 'WLC') {
        const kBT = 4.114;
        const Lp = params.persistenceLength;
        const Lc = params.contourLength;
        const zRatio = p.x / Lc;
        if (zRatio < 0.999 && zRatio > 0) {
          theoretical = (kBT / Lp) * (1.0 / (4.0 * Math.pow(1.0 - zRatio, 2)) - 0.25 + zRatio);
        } else if (zRatio >= 0.999) {
          theoretical = 10000.0; 
        }
        error = p.y - theoretical;
      } else {
        const kBT = 4.114;
        const Lk = params.kuhnLength;
        const Lc = params.contourLength;
        const z = (p.y * Lk) / kBT;
        // Langevin(z)
        let Lz = 0;
        if (Math.abs(z) > 1e-4) {
          const exp = Math.exp(2 * Math.abs(z));
          const coth = (exp + 1) / (exp - 1);
          Lz = Math.sign(z) * coth - 1.0 / z;
        } else {
          Lz = z / 3.0;
        }
        theoretical = Lc * Lz;
        error = p.x - theoretical;
      }

      return `${p.index},${p.xRaw.toExponential(6)},${p.yRaw.toExponential(6)},${p.x.toFixed(4)},${p.y.toFixed(4)},${theoretical.toFixed(4)},${error.toFixed(4)}`;
    });

    const blob = new Blob([csv + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `PolymerFit-${modelType}_Fitting_Results-${currentFileName.replace('.txt', '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetViewport = () => {
    handleAutoFitViewport(activePoints);
  };

  const handleCursorMove = (x: number | null, y: number | null) => {
    setCursorX(x);
    setCursorY(y);
  };

  // Read rightmost visible point
  const maxX = useMemo(() => {
    if (activePoints.length === 0) return 400.0;
    return Math.max(...activePoints.map(p => p.x));
  }, [activePoints]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 font-sans text-slate-800 overflow-hidden" id="polymer-fit-root">
      {/* Platform Header */}
      <Header
        currentFileName={currentFileName}
        isSampleData={isSampleData}
        segments={segments}
        activeSegmentIndex={activeSegmentIndex}
        onSegmentChange={handleSegmentChange}
        onFileUpload={handleFileUpload}
        onLoadSampleData={handleLoadSampleData}
      />

      {/* Primary Workspace Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Parameter Panel */}
        <Sidebar
          modelType={modelType}
          onModelTypeChange={setModelType}
          params={params}
          onParamsChange={handleParamsChange}
          coordinateShift={coordinateShift}
          onCoordinateShiftChange={setCoordinateShift}
          onResetViewport={handleResetViewport}
          fitResults={fitResults}
          maxX={maxX}
          hasExperimentalData={activePoints.length > 0}
          pickedX={pickedX}
          onClearPickedX={() => setPickedX(null)}
          constrainZeroAndPicked={constrainZeroAndPicked}
          onToggleConstrainZeroAndPicked={setConstrainZeroAndPicked}
        />

        {/* Graphics Plot Area */}
        <GraphArea
          points={activePoints}
          modelType={modelType}
          params={params}
          coordinateShift={coordinateShift}
          viewport={viewport}
          onViewportChange={setViewport}
          pickedX={pickedX}
          onPickX={setPickedX}
          isPickingMode={isPickingMode}
          onTogglePickingMode={setIsPickingMode}
          onCursorMove={handleCursorMove}
          onResetViewport={handleResetViewport}
          currentFileName={currentFileName}
        />
      </main>

      {/* Dark Metrics Footer */}
      <Footer
        cursorX={cursorX}
        cursorY={cursorY}
        modelType={modelType}
        params={params}
        fitResults={fitResults}
        onPerformGlobalFit={handlePerformGlobalFit}
        onExportCsv={handleExportCsv}
        hasPoints={activePoints.length > 0}
      />
    </div>
  );
}
