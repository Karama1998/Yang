export type ModelType = 'WLC' | 'FJC';

export interface ChainParameters {
  persistenceLength: number; // Lp in nm
  contourLength: number;     // Lc in nm
  kuhnLength: number;        // Lk in nm (for FJC, Lk = 2 * Lp normally)
}

export interface CoordinateShift {
  xOffset: number; // nm
  yOffset: number; // pN
  invertX?: boolean;
  invertY?: boolean;
}

export interface DataPoint {
  index: number;
  xRaw: number;      // raw separation/height etc, in m or nm
  yRaw: number;      // raw force/deflection etc, in N or pN
  x: number;         // shifted, converted (nm)
  y: number;         // shifted, converted (pN)
}

export interface JpkSegment {
  name: string;
  points: DataPoint[];
  columns: string[];
}

export interface FitResults {
  lp: number;
  lc: number;
  lk: number;
  chiSq: number;
  fittedPointsCount: number;
}
