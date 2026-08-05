// District centre coordinates (kept on land) for map defaults and simulated GPS.
import type { District } from './types';

export const DISTRICT_CENTERS: Record<District, [number, number]> = {
  'Anse Boileau': [-4.728, 55.485],
  'Baie Lazare': [-4.748, 55.487],
  'Grand Anse Mahé': [-4.678, 55.462],
  'Anse Royale': [-4.742, 55.514],
  'Anse Aux Pins': [-4.69, 55.514],
  Takamaka: [-4.769, 55.505],
  'Port Glaud': [-4.66, 55.423],
  'Baie Ste Anne Praslin': [-4.353, 55.76],
  'Grand Anse Praslin': [-4.318, 55.708],
  'La Digue': [-4.357, 55.837],
};

// Rough planar distance in degrees — good enough for proximity checks on one island group.
export const degDistance = (a: [number, number], b: [number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
