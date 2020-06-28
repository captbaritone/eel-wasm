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

// TODO: See if we can get rid of this
export class NamespaceResolver {
  _counter: number;
  _map: Map<string, number>;
  constructor() {
    this._counter = -1;
    this._map = new Map();
  }
  get(name: string): number {
    if (!this._map.has(name)) {
      this._counter++;
      this._map.set(name, this._counter);
    }
    // @ts-ignore we just set this.
    return this._map.get(name);
  }

  map<T>(cb: (value: string, i: number) => T): T[] {
    return Array.from(this._map.entries()).map(([value, i]) => cb(value, i));
  }
}

// Maintain an ordered list of indexes for namespace/key pairs.
// In Wasm binary variables are referenced by their index. In our emitter we
// want to emit variables indexes as we encounter their names. This data
// structure lets us issue variable indexes on demmand and then iterate through
// them post facto.
//
// TODO: We could improve this with a map to get constant time lookups, but I
// suspect it's not worth the complexity.
export class ScopedIdMap {
  _list: [string, string][];
  constructor() {
    this._list = [];
  }
  // Get the index of a given namespace/key pair
  get(namespace: string, key: string): number {
    const i = this._list.findIndex(([n, k]) => n === namespace && k === key);
    if (i === -1) {
      this._list.push([namespace, key]);
      return this._list.length - 1;
    }
    return i;
  }

  size(): number {
    return this._list.length;
  }
}
