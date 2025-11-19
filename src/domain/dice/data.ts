import type { FacesByColor } from './types';

export function normalizeColor(color: string): string {
  switch (color) {
    case 'Red': return 'RED';
    case 'Orange': return 'ORANGE';
    case 'Yellow': return 'YELLOW';
    case 'Green': return 'GREEN';
    case 'Blue': return 'BLUE';
    case 'Black': return 'BLACK';
    default: return String(color).toUpperCase();
  }
}

export function isAttackColor(color: string): boolean {
  return color === 'RED' || color === 'ORANGE' || color === 'YELLOW';
}

export async function loadDiceFaces(): Promise<FacesByColor> {
  const base = import.meta.env.BASE_URL || '/';
  const path = base.endsWith('/') ? base + 'warcrow_dice_faces.json' : base + '/warcrow_dice_faces.json';
  const resp = await fetch(path, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Failed to load warcrow_dice_faces.json');
  const faces = (await resp.json()) as FacesByColor;
  // Basic validation: each die should have 8 faces
  for (const color of Object.keys(faces)) {
    const arr = faces[color];
    if (!Array.isArray(arr) || arr.length !== 8) {
      throw new Error(`Die ${color} must have exactly 8 faces`);
    }
  }
  return faces;
}

