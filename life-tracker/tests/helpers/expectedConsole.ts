import { vi, type MockInstance } from 'vitest';

type ConsoleMethod = 'log' | 'warn' | 'error';

export function silenceExpectedConsole(prefixes: string[]): () => void {
  const spies: MockInstance[] = [];
  for (const method of ['log', 'warn', 'error'] as ConsoleMethod[]) {
    const original = console[method];
    const spy = vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      const first = String(args[0] ?? '');
      if (!prefixes.some((prefix) => first.startsWith(prefix))) {
        original(...args);
      }
    });
    spies.push(spy);
  }
  return () => {
    for (const spy of spies) spy.mockRestore();
  };
}
