import { DataPoint, FitResults } from '../types';

export const K_BT = 4.114; // pN * nm at room temperature (298 K, approx 25°C)

/**
 * Worm-Like Chain model (Marko-Siggia approximation)
 * Calculates force (pN) given extension (nm), persistence length Lp (nm), and contour length Lc (nm).
 */
export function wlcForce(x: number, Lp: number, Lc: number): number {
  if (Lc <= 0 || Lp <= 0) return 0;
  if (x <= 0) return 0;
  
  const zRatio = x / Lc;
  if (zRatio >= 0.999) {
    // Avoid divergence, provide linear extrapolation for extreme stretching
    const xLimit = 0.999 * Lc;
    const fLimit = (K_BT / Lp) * (1.0 / (4.0 * Math.pow(1.0 - 0.999, 2)) - 0.25 + 0.999);
    const slope = (K_BT / Lp) * (2.0 / (4.0 * Math.pow(1.0 - 0.999, 3)) + 1.0) / Lc;
    return fLimit + slope * (x - xLimit);
  }
  
  const term1 = 1.0 / (4.0 * Math.pow(1.0 - zRatio, 2));
  const term2 = 1.0 / 4.0;
  const term3 = zRatio;
  
  return (K_BT / Lp) * (term1 - term2 + term3);
}

/**
 * Standard Langevin Function: L(z) = coth(z) - 1/z
 */
export function langevin(z: number): number {
  const absZ = Math.abs(z);
  if (absZ < 1e-4) {
    return z / 3.0;
  }
  if (absZ < 0.1) {
    // Taylor Series expansion to avoid numerical cancellation
    return (z / 3.0) - (Math.pow(z, 3) / 45.0) + (2.0 * Math.pow(z, 5) / 945.0) - (Math.pow(z, 7) / 4725.0);
  }
  if (absZ > 100) {
    return Math.sign(z) * 1.0 - 1.0 / z;
  }
  const expTerm = Math.exp(2 * absZ);
  const coth = (expTerm + 1) / (expTerm - 1);
  return Math.sign(z) * coth - 1.0 / z;
}

/**
 * Freely Jointed Chain model (Langevin calculation)
 * Calculates extension (nm) given force (pN), Kuhn length Lk (nm), and contour length Lc (nm).
 */
export function fjcExtension(F: number, Lk: number, Lc: number): number {
  if (Lc <= 0 || Lk <= 0) return 0;
  if (F <= 0) return 0;
  
  const z = (F * Lk) / K_BT;
  return Lc * langevin(z);
}

/**
 * Performs a global 2D curve fit of the Marko-Siggia WLC model on a subset of experimental points.
 * 
 * Includes an option to force/constrain the fitting curve to pass exactly through the zero point
 * (0,0) and the user's picked point (xp, yp) on the graph.
 */
export function fitWlcModel(
  points: DataPoint[],
  pickedX: number,
  constrainZeroAndPicked: boolean = true
): FitResults {
  const fPoints = points.filter(p => p.x > 0 && p.x <= pickedX && p.y > 0);
  
  const failResult: FitResults = {
    lp: 45.0,
    lc: pickedX * 1.1,
    lk: 90.0,
    chiSq: 0,
    fittedPointsCount: 0
  };

  if (fPoints.length < 3) {
    return failResult;
  }

  // Find the exact experimental/shifted data point closest to the clicked boundary pickedX
  let pickedPoint: DataPoint | null = null;
  if (fPoints.length > 0) {
    let minDiff = Infinity;
    for (const p of fPoints) {
      const diff = Math.abs(p.x - pickedX);
      if (diff < minDiff) {
        minDiff = diff;
        pickedPoint = p;
      }
    }
  }

  // A. Constrained fit: Force curve through (0,0) and (xp, yp)
  if (constrainZeroAndPicked && pickedPoint && pickedPoint.x > 0 && pickedPoint.y > 0) {
    const xp = pickedPoint.x;
    const yp = pickedPoint.y;

    // Contour length Lc must be strictly larger than xp
    const lMin = xp * 1.002;
    const lMax = xp * 3.5;
    const gridSteps = 200;

    let bestLc = lMin * 1.1;
    let bestLp = 45.0;
    let minSSE = Infinity;

    // Grid search over Lc while analytically deriving Lp to force exact passage
    for (let i = 0; i < gridSteps; i++) {
      const candidateLc = lMin + (i / (gridSteps - 1)) * (lMax - lMin);
      const zRatio = xp / candidateLc;
      if (zRatio >= 0.999) continue;

      const phi = K_BT * (1.0 / (4.0 * Math.pow(1.0 - zRatio, 2)) - 0.25 + zRatio);
      const candidateLp = phi / yp; // ensures F(xp) = yp exactly
      if (candidateLp < 0.01 || candidateLp > 1000) continue;

      let sse = 0;
      for (const p of fPoints) {
        const fModel = wlcForce(p.x, candidateLp, candidateLc);
        sse += Math.pow(p.y - fModel, 2);
      }

      if (sse < minSSE) {
        minSSE = sse;
        bestLc = candidateLc;
        bestLp = candidateLp;
      }
    }

    // Local refinement
    let step = (lMax - lMin) / gridSteps;
    for (let k = 0; k < 6; k++) {
      const searchPoints = [bestLc - step, bestLc - step * 0.5, bestLc, bestLc + step * 0.5, bestLc + step];
      step = step * 0.4;

      for (const candidateLc of searchPoints) {
        if (candidateLc <= lMin || candidateLc >= lMax) continue;
        const zRatio = xp / candidateLc;
        if (zRatio >= 0.999) continue;

        const phi = K_BT * (1.0 / (4.0 * Math.pow(1.0 - zRatio, 2)) - 0.25 + zRatio);
        const candidateLp = phi / yp;
        if (candidateLp < 0.01 || candidateLp > 1000) continue;

        let sse = 0;
        for (const p of fPoints) {
          const fModel = wlcForce(p.x, candidateLp, candidateLc);
          sse += Math.pow(p.y - fModel, 2);
        }

        if (sse < minSSE) {
          minSSE = sse;
          bestLc = candidateLc;
          bestLp = candidateLp;
        }
      }
    }

    const chiSq = minSSE / (fPoints.length - 2 || 1);

    return {
      lp: parseFloat(bestLp.toFixed(3)),
      lc: parseFloat(bestLc.toFixed(2)),
      lk: parseFloat((2 * bestLp).toFixed(3)),
      chiSq: parseFloat(chiSq.toExponential(4) as any),
      fittedPointsCount: fPoints.length
    };
  }

  // B. Standard Unconstrained global curve fit regression
  const maxX = Math.max(...fPoints.map(p => p.x));
  const lMin = maxX * 1.005;
  const lMax = maxX * 3.5;
  const gridSteps = 120;
  
  let bestLc = lMin * 1.1;
  let bestLp = 45.0;
  let minSSE = Infinity;

  for (let i = 0; i < gridSteps; i++) {
    const candidateLc = lMin + (i / (gridSteps - 1)) * (lMax - lMin);
    
    let sumNum = 0;
    let sumDen = 0;
    let ok = true;

    for (const p of fPoints) {
      const zRatio = p.x / candidateLc;
      if (zRatio >= 0.999) {
        ok = false;
        break;
      }
      const phi = K_BT * (1.0 / (4.0 * Math.pow(1.0 - zRatio, 2)) - 0.25 + zRatio);
      sumNum += p.y * phi;
      sumDen += phi * phi;
    }

    if (!ok || sumDen === 0) continue;

    const beta = sumNum / sumDen;
    if (beta <= 0) continue;

    const candidateLp = 1.0 / beta;
    if (candidateLp < 0.01 || candidateLp > 1000) continue;

    let sse = 0;
    for (const p of fPoints) {
      const fModel = wlcForce(p.x, candidateLp, candidateLc);
      sse += Math.pow(p.y - fModel, 2);
    }

    if (sse < minSSE) {
      minSSE = sse;
      bestLc = candidateLc;
      bestLp = candidateLp;
    }
  }

  let step = (lMax - lMin) / gridSteps;
  for (let k = 0; k < 5; k++) {
    const searchPoints = [bestLc - step, bestLc - step * 0.5, bestLc, bestLc + step * 0.5, bestLc + step];
    step = step * 0.4;

    for (const candidateLc of searchPoints) {
      if (candidateLc <= lMin || candidateLc >= lMax) continue;

      let sumNum = 0;
      let sumDen = 0;
      let ok = true;

      for (const p of fPoints) {
        const zRatio = p.x / candidateLc;
        if (zRatio >= 0.999) {
          ok = false;
          break;
        }
        const phi = K_BT * (1.0 / (4.0 * Math.pow(1.0 - zRatio, 2)) - 0.25 + zRatio);
        sumNum += p.y * phi;
        sumDen += phi * phi;
      }

      if (!ok || sumDen === 0) continue;

      const beta = sumNum / sumDen;
      if (beta <= 0) continue;

      const candidateLp = 1.0 / beta;
      if (candidateLp < 0.01 || candidateLp > 1000) continue;

      let sse = 0;
      for (const p of fPoints) {
        const fModel = wlcForce(p.x, candidateLp, candidateLc);
        sse += Math.pow(p.y - fModel, 2);
      }

      if (sse < minSSE) {
        minSSE = sse;
        bestLc = candidateLc;
        bestLp = candidateLp;
      }
    }
  }

  const chiSq = minSSE / (fPoints.length - 2 || 1);

  return {
    lp: parseFloat(bestLp.toFixed(3)),
    lc: parseFloat(bestLc.toFixed(2)),
    lk: parseFloat((2 * bestLp).toFixed(3)),
    chiSq: parseFloat(chiSq.toExponential(4) as any),
    fittedPointsCount: fPoints.length
  };
}

/**
 * Performs a global curve fit of the FJC model on a subset of experimental points.
 * 
 * Includes an option to force/constrain the fitting curve to pass exactly through the zero point
 * (0,0) and the user's picked point (xp, yp) on the graph.
 */
export function fitFjcModel(
  points: DataPoint[],
  pickedX: number,
  constrainZeroAndPicked: boolean = true
): FitResults {
  const fPoints = points.filter(p => p.x > 0 && p.x <= pickedX && p.y > 0);
  
  const failResult: FitResults = {
    lp: 45.0,
    lc: pickedX * 1.1,
    lk: 90.0,
    chiSq: 0,
    fittedPointsCount: 0
  };

  if (fPoints.length < 3) {
    return failResult;
  }

  // Find exact experimental point closest to picked boundary
  let pickedPoint: DataPoint | null = null;
  if (fPoints.length > 0) {
    let minDiff = Infinity;
    for (const p of fPoints) {
      const diff = Math.abs(p.x - pickedX);
      if (diff < minDiff) {
        minDiff = diff;
        pickedPoint = p;
      }
    }
  }

  // A. Constrained fitting: Force curve through (0,0) and (xp, yp)
  if (constrainZeroAndPicked && pickedPoint && pickedPoint.x > 0 && pickedPoint.y > 0) {
    const xp = pickedPoint.x;
    const yp = pickedPoint.y;

    const lkMin = 0.05;
    const lkMax = 400.0;
    const gridSteps = 200;

    let bestLk = 90.0;
    let bestLc = xp * 1.1;
    let minSSE = Infinity;

    for (let i = 0; i < gridSteps; i++) {
      const candidateLk = lkMin + (i / (gridSteps - 1)) * (lkMax - lkMin);
      const z = (yp * candidateLk) / K_BT;
      const phi = langevin(z);
      if (phi <= 0) continue;

      const candidateLc = xp / phi; // ensures x(yp) = xp exactly
      if (candidateLc <= 0 || candidateLc > xp * 5) continue;

      let sse = 0;
      for (const p of fPoints) {
        const xModel = fjcExtension(p.y, candidateLk, candidateLc);
        sse += Math.pow(p.x - xModel, 2);
      }

      if (sse < minSSE) {
        minSSE = sse;
        bestLk = candidateLk;
        bestLc = candidateLc;
      }
    }

    let step = (lkMax - lkMin) / gridSteps;
    for (let k = 0; k < 6; k++) {
      const searchValues = [bestLk - step, bestLk - step * 0.5, bestLk, bestLk + step * 0.5, bestLk + step];
      step = step * 0.4;

      for (const candidateLk of searchValues) {
        if (candidateLk <= lkMin || candidateLk >= lkMax) continue;

        const z = (yp * candidateLk) / K_BT;
        const phi = langevin(z);
        if (phi <= 0) continue;

        const candidateLc = xp / phi;
        if (candidateLc <= 0 || candidateLc > xp * 5) continue;

        let sse = 0;
        for (const p of fPoints) {
          const xModel = fjcExtension(p.y, candidateLk, candidateLc);
          sse += Math.pow(p.x - xModel, 2);
        }

        if (sse < minSSE) {
          minSSE = sse;
          bestLk = candidateLk;
          bestLc = candidateLc;
        }
      }
    }

    const chiSq = minSSE / (fPoints.length - 2 || 1);

    return {
      lp: parseFloat((bestLk / 2.0).toFixed(3)),
      lc: parseFloat(bestLc.toFixed(2)),
      lk: parseFloat(bestLk.toFixed(3)),
      chiSq: parseFloat(chiSq.toExponential(4) as any),
      fittedPointsCount: fPoints.length
    };
  }

  // B. Standard Unconstrained FJC fitting
  const lkMin = 0.05;
  const lkMax = 400.0;
  const gridSteps = 120;

  let bestLk = 90.0;
  let bestLc = pickedX * 1.1;
  let minSSE = Infinity;

  for (let i = 0; i < gridSteps; i++) {
    const candidateLk = lkMin + (i / (gridSteps - 1)) * (lkMax - lkMin);

    let sumNum = 0;
    let sumDen = 0;

    for (const p of fPoints) {
      const z = (p.y * candidateLk) / K_BT;
      const phi = langevin(z);
      sumNum += p.x * phi;
      sumDen += phi * phi;
    }

    if (sumDen === 0) continue;
    const candidateLc = sumNum / sumDen;
    if (candidateLc <= 0 || candidateLc > Math.max(...fPoints.map(p => p.x)) * 5) continue;

    let sse = 0;
    for (const p of fPoints) {
      const xModel = fjcExtension(p.y, candidateLk, candidateLc);
      sse += Math.pow(p.x - xModel, 2);
    }

    if (sse < minSSE) {
      minSSE = sse;
      bestLk = candidateLk;
      bestLc = candidateLc;
    }
  }

  let step = (lkMax - lkMin) / gridSteps;
  for (let k = 0; k < 5; k++) {
    const searchValues = [bestLk - step, bestLk - step * 0.5, bestLk, bestLk + step * 0.5, bestLk + step];
    step = step * 0.4;

    for (const candidateLk of searchValues) {
      if (candidateLk <= lkMin || candidateLk >= lkMax) continue;

      let sumNum = 0;
      let sumDen = 0;

      for (const p of fPoints) {
        const z = (p.y * candidateLk) / K_BT;
        const phi = langevin(z);
        sumNum += p.x * phi;
        sumDen += phi * phi;
      }

      if (sumDen === 0) continue;
      const candidateLc = sumNum / sumDen;
      if (candidateLc <= 0) continue;

      let sse = 0;
      for (const p of fPoints) {
        const xModel = fjcExtension(p.y, candidateLk, candidateLc);
        sse += Math.pow(p.x - xModel, 2);
      }

      if (sse < minSSE) {
        minSSE = sse;
        bestLk = candidateLk;
        bestLc = candidateLc;
      }
    }
  }

  const chiSq = minSSE / (fPoints.length - 2 || 1);

  return {
    lp: parseFloat((bestLk / 2.0).toFixed(3)),
    lc: parseFloat(bestLc.toFixed(2)),
    lk: parseFloat(bestLk.toFixed(3)),
    chiSq: parseFloat(chiSq.toExponential(4) as any),
    fittedPointsCount: fPoints.length
  };
}

/**
 * Calculates Lp given Lc and the exact picked point (xp, yp) on the curve for WLC.
 */
export function getConstrainedLp(Lc: number, xp: number, yp: number): number {
  if (Lc <= xp) return 45.0;
  const zRatio = xp / Lc;
  if (zRatio >= 0.999 || zRatio <= 0) {
    return 45.0;
  }
  const phi = K_BT * (1.0 / (4.0 * Math.pow(1.0 - zRatio, 2)) - 0.25 + zRatio);
  return phi / yp;
}

/**
 * Solves for Lc given Lp and the exact picked point (xp, yp) on the curve for WLC.
 */
export function getConstrainedLcWlc(Lp: number, xp: number, yp: number): number {
  const target = (yp * Lp) / K_BT;
  let low = 1e-6;
  let high = 0.9989;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const val = 1.0 / (4.0 * Math.pow(1.0 - mid, 2)) - 0.25 + mid;
    if (val < target) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const z = (low + high) / 2;
  return xp / z;
}

/**
 * Calculates Lc given Lk and the exact picked point (xp, yp) on the curve for FJC.
 */
export function getConstrainedLcFjc(Lk: number, xp: number, yp: number): number {
  const z = (yp * Lk) / K_BT;
  const phi = langevin(z);
  if (phi <= 0) return xp * 1.1;
  return xp / phi;
}

/**
 * Solves for Lk given Lc and the exact picked point (xp, yp) on the curve for FJC.
 */
export function getConstrainedLkFjc(Lc: number, xp: number, yp: number): number {
  let ratio = xp / Lc;
  if (ratio >= 0.999) ratio = 0.999;
  if (ratio <= 0.001) ratio = 0.001;
  
  let low = 1e-4;
  let high = 50000.0;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const val = langevin(mid);
    if (val < ratio) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const u = (low + high) / 2;
  return (u * K_BT) / yp;
}
