export function arrayJoin<T1, T2>(arr: T1[], joiner: T2): Array<T1 | T2> {
  const newArr = [];
  for (let i = 0; i < arr.length; i++) {
    newArr.push(arr[i]);
    const last = i === arr.length - 1;
    if (!last) {
      newArr.push(joiner);
    }
  }
  return newArr;
}

export function flatten<T>(arr: Array<T[]>): T[] {
  const newArr: T[] = [];
  arr.forEach(subArr => {
    newArr.push(...subArr);
  });
  return newArr;
}

export const flattenTwice = (arr: Array<number[] | number>): number[] =>
  [].concat.apply([], arr);

export function times<T>(n: number, cb: (i: number) => T): T[] {
  return new Array(n).fill(null).map((_, i) => cb(i));
}

export function repeat(n: number, char: string): string {
  return new Array(n).fill(char).join("");
}

// Maintain an ordered list of indexes for namespace/key pairs.
// In Wasm binary variables are referenced by their index. In our emitter we
// want to emit variables indexes as we encounter their names. This data
// structure lets us issue variable indexes on demmand and then iterate through
// them post facto.
//
// `null` may be passed for the namespace argument in order to get a global
// variable that exists in all namespaces.
export class ScopedIdMap {
  _map: Map<string, number>;
  constructor() {
    this._map = new Map();
  }
  // Get the index of a given namespace/key pair
  get(namespace: string | null, key: string): number {
    const jointKey = namespace == null ? key : `${namespace}::${key}`;
    if (!this._map.has(jointKey)) {
      this._map.set(jointKey, this._map.size);
    }
    // @ts-ignore We know the key is here.
    return this._map.get(jointKey);
  }

  size(): number {
    return this._map.size;
  }
}

export function formatList(list: string[]): string {
  if (list.length === 0) {
    throw new Error("Cannot format an empty list");
  }
  if (list.length === 1) {
    return list[0];
  }
  const quoted = list.map(name => `"${name}"`);
  const last = quoted.pop();
  return quoted.join(", ") + ` and ${last}`;
}
