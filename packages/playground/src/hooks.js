import { useState, useEffect, useCallback, useMemo } from "react";
import { parse, compileModule, shims } from "eel-wasm";
import _wabt from "wabt";

const wabt = _wabt();

const identity = val => val;

export function useUrlState(
  key,
  initial,
  { serialize = identity, deserialize = identity } = {}
) {
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
  }, [eel, key, serialize]);
  return [eel, setEel];
}

export function useForceUpdate() {
  const [, setRunCount] = useState(0);

  return useCallback(() => {
    setRunCount(count => count + 1);
  }, []);
}

async function modFromWasm(wasm, globals) {
  if (wasm == null || globals == null) {
    return null;
  }

  const mod = await WebAssembly.compile(wasm);

  var importObject = {
    main: { ...globals },
    shims
  };

  return await WebAssembly.instantiate(mod, importObject);
}

export function useAst(eel) {
  const [ast, setAst] = useState(null);
  const [astError, setAstError] = useState(null);
  useEffect(() => {
    try {
      let _ast = parse(eel);
      setAst(_ast);
      setAstError(null);
    } catch (e) {
      setAstError(e);
    }
  }, [eel]);

  return [ast, astError];
}

export function useWasm(code, globals, eelVersion) {
  const [wasm, setWasm] = useState(null);
  const [wasmError, setWasmError] = useState(null);

  useEffect(() => {
    if (code == null) {
      return;
    }
    try {
      const wasm = compileModule({
        functions: {
          main: { pool: "main", code }
        },
        pools: { main: new Set(Object.keys(globals)) },
        eelVersion
      });
      setWasm(wasm);
      setWasmError(null);
    } catch (e) {
      setWasmError(e);
    }
  }, [code, eelVersion, globals]);

  return [wasm, wasmError, eelVersion];
}

export function useWat(wasm) {
  return useMemo(() => {
    if (wasm == null) {
      return [null];
    }
    const myModule = wabt.readWasm(wasm, { readDebugNames: true });
    const wat = myModule.toText({ foldExprs: false, inlineExport: false });
    return [wat];
  }, [wasm]);
}

export function useMod(wasm, globals) {
  const [mod, setMod] = useState(null);
  const [modError, setModError] = useState(null);

  useEffect(() => {
    setMod(null);
    if (wasm == null) {
      return;
    }
    let unmounted = false;

    modFromWasm(wasm, globals)
      .then(mod => {
        if (unmounted) {
          return;
        }
        setMod(mod);
      })
      .catch(e => {
        if (unmounted) {
          return;
        }
        setModError(e);
      });

    return () => {
      unmounted = true;
    };
    // We intentionally omit `globals` from this array. When globals updates it
    // should generate a new `wasm` string, and we want to ensure we wait for the
    // new `wasm` rather than trying to build the mod with the old `wasm` and the
    // new `globals`.
    // eslint-disable-next-line
  }, [wasm]);

  return [mod, modError];
}

function serializeGlobals(globals) {
  const obj = {};
  Object.entries(globals).forEach(([name, global]) => {
    obj[name] = global.value;
  });
  return JSON.stringify(obj);
}

function deserializeGlobals(str) {
  if (!str) {
    return {};
  }
  const globals = {};
  try {
    const obj = JSON.parse(str);
    Object.entries(obj).forEach(([name, value]) => {
      globals[name] = new WebAssembly.Global(
        { value: "f64", mutable: true },
        value
      );
    });
  } catch (e) {
    console.error(e);
  }
  return globals;
}

export function useGlobals() {
  const [globals, setGlobals] = useUrlState(
    "globals",
    { foo: new WebAssembly.Global({ value: "f64", mutable: true }, 0) },
    { serialize: serializeGlobals, deserialize: deserializeGlobals }
  );

  const addGlobal = useCallback(
    name => {
      setGlobals(globals => {
        return {
          ...globals,
          [name]: new WebAssembly.Global({ value: "f64", mutable: true }, 0)
        };
      });
    },
    [setGlobals]
  );

  const removeGlobal = useCallback(
    name => {
      setGlobals(globals => {
        const { [name]: _, ...newGlobals } = globals;
        return newGlobals;
      });
    },
    [setGlobals]
  );

  return { globals, addGlobal, removeGlobal };
}
