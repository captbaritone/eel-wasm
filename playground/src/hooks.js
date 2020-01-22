import { useState, useEffect, useCallback } from "react";

const identity = val => val;

export function useUrlState(key, initial, {serialize = identity, deserialize = identity} = {}) {
  const [eel, setEel] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlEel = params.get(key);
    return urlEel ? deserialize(atob(urlEel)) : initial;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, btoa(serialize(eel)));
    const newRelativePathQuery =
      window.location.pathname + "?" + params.toString();
    window.history.pushState(null, "", newRelativePathQuery);
  }, [eel, key]);
  return [eel, setEel];
}

export function useForceUpdate() {
  const [, setRunCount] = useState(0);

  return useCallback(() => {
    setRunCount(count => count + 1);
  }, []);
}
