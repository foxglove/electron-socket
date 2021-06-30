import { Transform } from "stream";

export type CreateTransform = () => Transform;

interface Disposable {
  dispose(): void;
}

// Store references to created sockets and servers
const entities = new Map<number, Disposable>();
let curId = 0;

// Return an incrementing unique integer identifier
export function nextId(): number {
  return curId++;
}

// Store a reference to an entity that can be disposed later
export function registerEntity(id: number, entity: Disposable): void {
  entities.set(id, entity);
}
