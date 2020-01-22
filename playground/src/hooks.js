import { useState, useEffect } from "react";

export function useUrlState(key, initial) {
  const [eel, setEel] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlEel = params.get(key);
    return urlEel ? atob(urlEel) : initial;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, btoa(eel));
    const newRelativePathQuery =
      window.location.pathname + "?" + params.toString();
    window.history.pushState(null, "", newRelativePathQuery);
  }, [eel]);
  return [eel, setEel];
}
