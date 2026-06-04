import { DataPoint, JpkSegment } from '../types';

/**
 * Parses JPK exported text files.
 * These files contain tab or space separated lines, with metadata starting with '#'
 * and columns representing force, separation, and piezo heights.
 */
export function parseJpkFile(content: string): JpkSegment[] {
  const lines = content.split(/\r?\n/);
  const segments: JpkSegment[] = [];
  
  let currentSegmentName = 'Full Curve';
  let currentSegmentLines: string[] = [];
  let headerFoundForCurrent = false;
  
  // First, check if the file explicitly defines Segments
  const hasSegmentHeaders = lines.some(line => {
    const lower = line.toLowerCase();
    return lower.startsWith('# segment:') || lower.startsWith('#segment:');
  });

  if (hasSegmentHeaders) {
    let activeSegmentName = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('# segment:') || trimmed.toLowerCase().startsWith('#segment:')) {
        // Save previous segment if any
        if (activeSegmentName && currentSegmentLines.length > 0) {
          segments.push(parseRawSegmentLines(activeSegmentName, currentSegmentLines));
        }
        activeSegmentName = trimmed.split(':')[1]?.trim() || 'Segment';
        currentSegmentLines = [];
      } else {
        if (activeSegmentName) {
          currentSegmentLines.push(line);
        }
      }
    }
    // Add the final segment
    if (activeSegmentName && currentSegmentLines.length > 0) {
      segments.push(parseRawSegmentLines(activeSegmentName, currentSegmentLines));
    }
  } else {
    // Treat the entire file as a single segment
    segments.push(parseRawSegmentLines('Full Curve', lines));
  }

  // If we parsed segments but couldn't extract points, fallback to parsing everything
  if (segments.length === 0 || segments.every(s => s.points.length === 0)) {
    return [parseRawSegmentLines('Full Curve', lines)];
  }

  return segments;
}

function parseRawSegmentLines(name: string, lines: string[]): JpkSegment {
  const dataRows: string[][] = [];
  let detectedHeaders: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#')) {
      // Check if it lists column headers
      // e.g. "# Columns: tip-sample-separation force vertical-deflection height"
      if (trimmed.toLowerCase().includes('columns:')) {
        const headerPart = trimmed.replace(/#\s*[Cc]olumns:\s*/, '');
        detectedHeaders = headerPart.split(/[\s\t,]+/).map(h => h.trim()).filter(Boolean);
      } else if (trimmed.toLowerCase().includes('columns')) {
        // Fallback for general columns headers
        const parts = trimmed.split(/[\s\t]+/);
        if (parts.length > 2) {
          detectedHeaders = parts.slice(1).map(h => h.trim());
        }
      }
      continue;
    }

    // Try to split row by whitespace/comma
    const parts = trimmed.split(/[\s\t,]+/);
    const parsedFloats = parts.map(p => parseFloat(p));

    // Check if the majority of parts are valid numbers
    const validCount = parsedFloats.filter(v => !isNaN(v)).length;
    if (validCount >= 2 && validCount >= parts.length - 2) {
      dataRows.push(parts);
    } else {
      // It might be a header index line without a leading '#'
      if (parts.length >= 2 && isNaN(parseFloat(parts[0])) && isNaN(parseFloat(parts[1]))) {
        detectedHeaders = parts.map(h => h.trim());
      }
    }
  }

  // If no headers were detected, let's create generic ones
  if (detectedHeaders.length === 0 && dataRows.length > 0) {
    const maxCols = Math.max(...dataRows.map(r => r.length));
    detectedHeaders = Array.from({ length: maxCols }, (_, i) => `Column_${i + 1}`);
  }

  // Map to DataPoints
  const points: DataPoint[] = [];

  // Determine indices of preferred X and Y columns
  let xColIdx = -1;
  let yColIdx = -1;

  const headersLower = detectedHeaders.map(h => h.toLowerCase());

  // Search priority for X (Extension/Separation in meters or nm):
  const xKeywords = [
    'tip-sample-separation',
    'separation',
    'tip_sample_separation',
    'measured-height',
    'height (measured)',
    'smoothedcapasensorsignalan',
    'smoothed',
    'height',
    'z-spec',
    'z'
  ];

  for (const keyword of xKeywords) {
    const idx = headersLower.findIndex(h => h.includes(keyword));
    if (idx !== -1) {
      xColIdx = idx;
      break;
    }
  }

  // Search priority for Y (Force in Newtons or pN):
  const yKeywords = [
    'force',
    'vertical-deflection',
    'vdeflection',
    'vdef',
    'deflection'
  ];

  for (const keyword of yKeywords) {
    const idx = headersLower.findIndex(h => h.includes(keyword));
    if (idx !== -1) {
      yColIdx = idx;
      break;
    }
  }

  // Fallbacks if no columns found
  if (xColIdx === -1 && detectedHeaders.length > 0) xColIdx = 0; // default first column
  if (yColIdx === -1 && detectedHeaders.length > 1) yColIdx = 1; // default second column
  if (yColIdx === -1 && detectedHeaders.length > 0) yColIdx = 0;

  // Compute unit scale checks
  let avgAbsX = 0;
  let avgAbsY = 0;
  let validRowIndicesCount = 0;

  dataRows.forEach(row => {
    const xVal = parseFloat(row[xColIdx]);
    const yVal = parseFloat(row[yColIdx]);
    if (!isNaN(xVal) && !isNaN(yVal)) {
      avgAbsX += Math.abs(xVal);
      avgAbsY += Math.abs(yVal);
      validRowIndicesCount++;
    }
  });

  if (validRowIndicesCount > 0) {
    avgAbsX /= validRowIndicesCount;
    avgAbsY /= validRowIndicesCount;
  }

  // Determine if X requires SI-to-nm scale factor (multiplying by 10^9)
  // Usually, AFM separation is in meters (scale ~ 1e-7 to 1e-9).
  // If avgAbsX is very small, e.g., < 0.001 (such as 1e-7), it's in meters.
  // Exception: if it's already in nanometers (scale ~ 10 to 1000).
  const isXInMeters = avgAbsX > 0 && avgAbsX < 1e-3;
  const xMultiplier = isXInMeters ? 1e9 : 1.0;

  // Determine if Y requires SI-to-pN scale factor (multiplying by 10^12)
  // AFM Force is usually in Newtons (scale ~ 1e-10 to 1e-12).
  // If avgAbsY is very small, e.g., < 1e-4, it's in Newtons.
  const isYInNewtons = avgAbsY > 0 && avgAbsY < 1e-4;
  const yMultiplier = isYInNewtons ? 1e12 : 1.0;

  // Create DataPoints
  let count = 0;
  dataRows.forEach(row => {
    const xRaw = parseFloat(row[xColIdx]);
    const yRaw = parseFloat(row[yColIdx]);

    if (!isNaN(xRaw) && !isNaN(yRaw)) {
      points.push({
        index: count++,
        xRaw,
        yRaw,
        x: xRaw * xMultiplier,
        y: yRaw * yMultiplier,
      });
    }
  });

  return {
    name,
    points,
    columns: detectedHeaders,
  };
}

/**
 * Generates realistic mock JPK Force Curve data for user testing.
 * Implements a sample pull curve modeling a polymer unfolding/stretching (WLC background)
 * with a single domain unfolding event and typical retract noise.
 */
export function generateMockJpkRetractFile(): string {
  let file = `# JPK Instruments Force Curve Text File\n`;
  file += `# Segment: extend\n`;
  file += `# Columns: tip-sample-separation force vertical-deflection height\n`;
  // We'll jump to retract segment directly to make it super simple
  file += `# Segment: retract\n`;
  file += `# Columns: tip-sample-separation force height\n`;
  
  // Let's generate a polymer stretching curve with WLC profile plus noise
  // Contour length = 400 nm, persistence length = 0.4 nm
  // Plus some unfolding peaks at 180nm
  const Lc = 350.0; // nm
  const Lp = 0.45;  // nm
  const kBT = 4.11; // pN*nm

  const pointsCount = 450;
  for (let i = 0; i <= pointsCount; i++) {
    const x = (i / pointsCount) * 340.0; // max 340 nm extension
    let fModel = 0.0;

    if (x < Lc) {
      // Marko-Siggia WLC
      const zRatio = x / Lc;
      const term1 = 1.0 / (4.0 * Math.pow(1.0 - zRatio, 2));
      const term2 = 1.0 / 4.0;
      const term3 = zRatio;
      fModel = (kBT / Lp) * (term1 - term2 + term3);
    } else {
      fModel = 1500.0; // saturate
    }

    // Add a classic protein domain unfolding event around 150nm!
    // This makes the representation look exactly like a real JPK unfold curve!
    // At x > 150nm, the polymer stretches under WLC. At x = 150nm, the domain is intact,
    // stretching with Lc = 250nm. At x >= 150nm, the domain ruptures, shifting Lc to 350nm.
    let force = 0;
    if (x < 150) {
      // Stretched as shorter contour length (e.g. 230 nm)
      const Lc_short = 200.0;
      if (x < Lc_short) {
        const zRatio = x / Lc_short;
        force = (kBT / Lp) * (1.0 / (4.0 * Math.pow(1.0 - zRatio, 2)) - 1.0/4.0 + zRatio);
      } else {
        force = 200.0;
      }
    } else {
      // Stretched as fully extended contour length (350 nm)
      force = fModel;
    }

    // Add a baseline offset of -15 pN
    force -= 10.0;

    // Add random AFM noise (approx +- 3 pN)
    const noise = (Math.sin(i * 0.3) * 1.5 + Math.cos(i * 0.7) * 1.0) + (Math.random() - 0.5) * 1.0;
    const finalForce = force + noise;

    // Convert back to SI units (meters and Newtons) for raw columns, to test the scale-detector
    const rawX = x * 1e-9;
    const rawY = finalForce * 1e-12;
    const rawHeight = (400.0 - x) * 1e-9;

    file += `${rawX.toExponential(8)}\t${rawY.toExponential(8)}\t${rawHeight.toExponential(8)}\n`;
  }

  return file;
}
