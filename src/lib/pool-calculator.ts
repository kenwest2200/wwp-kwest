export const GALLONS_PER_CU_FT = 7.48;
export const MINUTES_PER_DAY = 1440;

export type ShapeId = "rectangle" | "circle" | "oval" | "oblong" | "kidney";

export const SHAPE_LABELS: Record<ShapeId, string> = {
  rectangle: "Rectangle",
  circle: "Circle",
  oval: "Oval",
  oblong: "Oblong",
  kidney: "Kidney",
};

/** ft + in/12; empty strings treated as 0 (like the app). */
export function toFeet(ft: number | string, inches: number | string): number {
  return Number(ft || 0) + Number(inches || 0) / 12;
}

function dAvgFromShallowDeep(
  shallowFt: number | string,
  shallowIn: number | string,
  deepFt: number | string,
  deepIn: number | string,
): number {
  return (toFeet(shallowFt, shallowIn) + toFeet(deepFt, deepIn)) / 2;
}

/**
 * `pairs` — for each dimension [ft, in] in shape order (see EstimatePoolVolume in spec).
 */
export function estimateVolumeGallons(shape: ShapeId, pairs: [string, string][]): number {
  const p = (i: number) => toFeet(pairs[i]?.[0] ?? 0, pairs[i]?.[1] ?? 0);

  switch (shape) {
    case "rectangle": {
      const L = p(0);
      const W = p(1);
      const dAvg = dAvgFromShallowDeep(
        pairs[2][0],
        pairs[2][1],
        pairs[3][0],
        pairs[3][1],
      );
      return Math.floor(L * W * dAvg * GALLONS_PER_CU_FT);
    }
    case "circle": {
      const r = p(0);
      const dAvg = dAvgFromShallowDeep(
        pairs[1][0],
        pairs[1][1],
        pairs[2][0],
        pairs[2][1],
      );
      return Math.floor(Math.PI * r * r * dAvg * GALLONS_PER_CU_FT);
    }
    case "oval": {
      const r1 = p(0);
      const r2 = p(1);
      const dAvg = dAvgFromShallowDeep(
        pairs[2][0],
        pairs[2][1],
        pairs[3][0],
        pairs[3][1],
      );
      return Math.floor(Math.PI * r1 * r2 * dAvg * GALLONS_PER_CU_FT);
    }
    case "oblong": {
      const L = p(0);
      const W = p(1);
      const r = p(2);
      const dAvg = dAvgFromShallowDeep(
        pairs[3][0],
        pairs[3][1],
        pairs[4][0],
        pairs[4][1],
      );
      return Math.floor((L * W + r * r * Math.PI) * dAvg * GALLONS_PER_CU_FT);
    }
    case "kidney": {
      const L = p(0);
      const A = p(1);
      const B = p(2);
      const dAvg = dAvgFromShallowDeep(
        pairs[3][0],
        pairs[3][1],
        pairs[4][0],
        pairs[4][1],
      );
      return Math.floor((A + B) * L * 0.45 * dAvg * GALLONS_PER_CU_FT);
    }
    default:
      return 0;
  }
}

export function gpmFromVolume(
  poolVolumeGallons: number,
  turnoversPerDay: number,
): number {
  const g = Math.max(0, Math.floor(poolVolumeGallons));
  const t = Math.min(6, Math.max(1, Math.floor(turnoversPerDay) || 1));
  return (g * t) / MINUTES_PER_DAY;
}

export function formatGpm(value: number): string {
  return value.toFixed(1);
}

export interface DimensionField {
  key: string;
  label: string;
}

export function dimensionFieldsForShape(shape: ShapeId): DimensionField[] {
  switch (shape) {
    case "rectangle":
      return [
        { key: "length", label: "Length" },
        { key: "width", label: "Width" },
        { key: "shallow", label: "Shallow depth" },
        { key: "deep", label: "Deep end depth" },
      ];
    case "circle":
      return [
        { key: "radius", label: "Radius" },
        { key: "shallow", label: "Shallow depth" },
        { key: "deep", label: "Deep end depth" },
      ];
    case "oval":
      return [
        { key: "radius1", label: "Radius 1" },
        { key: "radius2", label: "Radius 2" },
        { key: "shallow", label: "Shallow depth" },
        { key: "deep", label: "Deep end depth" },
      ];
    case "oblong":
      return [
        { key: "length", label: "Length" },
        { key: "width", label: "Width" },
        { key: "radius", label: "Radius" },
        { key: "shallow", label: "Shallow depth" },
        { key: "deep", label: "Deep end depth" },
      ];
    case "kidney":
      return [
        { key: "length", label: "Length" },
        { key: "a", label: "A" },
        { key: "b", label: "B" },
        { key: "shallow", label: "Shallow depth" },
        { key: "deep", label: "Deep end depth" },
      ];
    default:
      return [];
  }
}
