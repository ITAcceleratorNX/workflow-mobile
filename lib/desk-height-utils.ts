/**
 * Рекомендуемая высота стола (см) сидя и стоя по росту и весу.
 */

export function calculateDeskHeights(
  heightCm: number,
  weightKg: number | null | undefined
): { sitting: number; standing: number } | null {
  if (Number.isNaN(heightCm) || heightCm < 100 || heightCm > 250) {
    return null;
  }
  const sitting = Math.round(heightCm * 0.29 + 20);
  let standing = Math.round(heightCm * 0.62 - 2);
  const w = weightKg;
  if (w != null && !Number.isNaN(w) && w > 0) {
    let adj = 0;
    if (w <= 64) adj = -2;
    else if (w <= 69) adj = -1;
    else if (w <= 79) adj = 0;
    else if (w <= 89) adj = 1;
    else adj = 2;
    standing += adj;
  }
  return { sitting, standing };
}
