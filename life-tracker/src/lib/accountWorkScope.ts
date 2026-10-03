export interface AccountWorkScope {
  userId: string | null;
  generation: number;
}

let activeUserId: string | null = null;
let generation = 0;

export function scopeAccountWork(userId: string | null): number {
  if (activeUserId === userId) return generation;
  activeUserId = userId;
  generation += 1;
  return generation;
}

export function getAccountWorkScope(): AccountWorkScope {
  return { userId: activeUserId, generation };
}

export function captureAccountWorkGeneration(userId: string): number | null {
  return activeUserId === userId ? generation : null;
}

export function isAccountWorkCurrent(
  userId: string,
  expectedGeneration: number
): boolean {
  return activeUserId === userId && generation === expectedGeneration;
}

export function __resetAccountWorkScopeForTests(): void {
  activeUserId = null;
  generation = 0;
}
