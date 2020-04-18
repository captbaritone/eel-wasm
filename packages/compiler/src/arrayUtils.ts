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
