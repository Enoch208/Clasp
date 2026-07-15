export function isValidAmount(amount: string): boolean {
  return /^(0|[1-9]\d*)$/.test(amount);
}

function toBig(amount: string): bigint {
  if (!isValidAmount(amount)) {
    throw new Error(`invalid amount (must be a non-negative integer string): ${amount}`);
  }
  return BigInt(amount);
}

export function addAmounts(a: string, b: string): string {
  return (toBig(a) + toBig(b)).toString();
}

export function subAmounts(a: string, b: string): string {
  const result = toBig(a) - toBig(b);
  if (result < 0n) throw new Error(`amount underflow: ${a} - ${b}`);
  return result.toString();
}

export function cmpAmounts(a: string, b: string): -1 | 0 | 1 {
  const x = toBig(a);
  const y = toBig(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function lteAmounts(a: string, b: string): boolean {
  return cmpAmounts(a, b) <= 0;
}

export function gtAmounts(a: string, b: string): boolean {
  return cmpAmounts(a, b) === 1;
}
