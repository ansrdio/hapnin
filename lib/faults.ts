// Named failure points for the money-path integration tests. A test arms a
// point (armFault("fulfil:after-claim")) and the next time the code passes it,
// it throws — standing in for a crash, a timeout or a lost connection at
// exactly that moment. Inert unless HAPNIN_TEST=1, so production can never
// trip one. Client-safe: no imports.

const armed = new Set<string>();

export class InjectedFault extends Error {
  constructor(point: string) {
    super(`INJECTED_FAULT:${point}`);
  }
}

export function fault(point: string): void {
  if (process.env.HAPNIN_TEST !== "1") return;
  if (armed.has(point)) {
    armed.delete(point); // one shot, like a real crash
    throw new InjectedFault(point);
  }
}

export function armFault(point: string): void {
  if (process.env.HAPNIN_TEST !== "1") throw new Error("armFault outside tests");
  armed.add(point);
}

export function clearFaults(): void {
  armed.clear();
}
