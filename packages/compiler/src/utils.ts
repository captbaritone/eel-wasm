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

export function repeat(n: number, char: string): string {
  return new Array(n).fill(char).join("");
}

// Maintain an ordered list of indexes for namespace/key pairs.
// In Wasm binary variables are referenced by their index. In our emitter we
// want to emit variables indexes as we encounter their names. This data
// structure lets us issue variable indexes on demmand and then iterate through
// them post facto.
export class ScopedIdMap {
  _counter: number;
  _map: Map<string, Map<string, number>>;
  _list: Array<[string, string]>;
  _offset: number;
  constructor(offset: number = 0) {
    this._offset = offset;
    this._counter = -1 + offset;
    this._map = new Map();
    this._list = [];
  }
  // Ensure a namespace/key pair are present in the map
  add(namespace: string, key: string): void {
    this.get(namespace, key);
  }
  has(namespace: string, key: string): boolean {
    return this._map.has(namespace) && this._map.get(namespace).has(key);
  }
  // Get the index of a given namespace/key pair
  get(namespace: string, key: string): number {
    if (!this._map.has(namespace)) {
      this._map.set(namespace, new Map());
    }

    // @ts-ignore We just checked that, dude.
    const namespaceMap: Map<string, number> = this._map.get(namespace);

    if (!namespaceMap.has(key)) {
      this._counter++;
      this._list.push([namespace, key]);
      namespaceMap.set(key, this._counter);
    }

    // @ts-ignore We just checked that, dude.
    return namespaceMap.get(key);
  }

  map<T>(cb: (namespace: string, key: string, index: number) => T): T[] {
    return this._list.map(([namespace, key], index) => {
      return cb(namespace, key, index);
    });
  }
  size(): number {
    return this._counter + 1 - this._offset;
  }
}
