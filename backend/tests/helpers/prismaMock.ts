import type { PrismaClient } from '@prisma/client';

type DeepMockDepth = 0 | 1 | 2 | 3;
type PreviousDepth = [0, 0, 1, 2];

export type PrismaMock = DeepMocked<PrismaClient, 3>;

type DeepMocked<T, Depth extends DeepMockDepth> = Depth extends 0
  ? T
  : T extends (...args: infer Args) => infer Result
    ? jest.Mock<Awaited<Result>, Args>
    : T extends object
      ? { [Key in keyof T]: DeepMocked<T[Key], PreviousDepth[Depth]> }
      : T;

function createMockNode(): object {
  const children = new Map<PropertyKey, object>();
  const mockFunction = jest.fn().mockResolvedValue(undefined);

  return new Proxy(mockFunction, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) {
        return Reflect.get(target, property, receiver);
      }
      if (property === 'then') {
        return undefined;
      }
      let child = children.get(property);
      if (!child) {
        child = createMockNode();
        children.set(property, child);
      }
      return child;
    },
  });
}

export function createPrismaMock(): PrismaMock {
  return createMockNode() as PrismaMock;
}
