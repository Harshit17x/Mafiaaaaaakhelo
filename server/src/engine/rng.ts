import { randomInt } from 'node:crypto';

export type RandomIntFn = (minInclusive: number, maxExclusive: number) => number;

export const cryptoRandomInt: RandomIntFn = (minInclusive, maxExclusive) => {
  return randomInt(minInclusive, maxExclusive);
};

export function shuffleWithRng<T>(
  items: readonly T[],
  randInt: RandomIntFn = cryptoRandomInt
): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i + 1);
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

