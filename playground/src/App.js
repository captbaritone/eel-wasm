import React, { useEffect, useState, useCallback, useMemo } from "react";
import "./App.css";
import { parse } from "parser";
import { emit } from "emitter";
import Editor, { ControlledEditor } from "@monaco-editor/react";
import { useUrlState, useForceUpdate } from "./hooks";
import shims from "shims";
import _wabt from "wabt";

const wabt = _wabt();
function Column({ children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        flexBasis: 0
      }}
    >
      {children}
    </div>
  );
}

function ErrorBlock({ children }) {
  return <div style={{ backgroundColor: "lightPink" }}>{children}</div>;
}

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  lineNumbers: "off"
};

async function modFromWat(wat, globals) {
  if (wat == null || globals == null) {
    return null;
  }

  const wasmModule = wabt.parseWat("somefile.wat", wat);
  const { buffer } = wasmModule.toBinary({});
  const mod = await WebAssembly.compile(buffer);

  var importObject = {
    js: { ...globals },
    imports: shims
  };

  return await WebAssembly.instantiate(mod, importObject);
}

function useAst(eel) {
  const [ast, setAst] = useState(null);
  const [astError, setAstError] = useState(null);
  useEffect(() => {
    try {
      setAst(parse(eel));
      setAstError(null);
    } catch (e) {
      setAstError(e.message);
    }
  }, [eel]);

  return [ast, astError];
}

function useWasm(ast, globals) {
  const [wasm, setWasm] = useState(null);
  const [wasmError, setWasmError] = useState(null);

  useEffect(() => {
    if (ast == null) {
      return;
    }
    try {
      const exportedFunctions = [
        {
          type: "FUNCTION_EXPORT",
          name: "main",
          function: ast
        }
      ];

      const moduleAst = { type: "MODULE", exportedFunctions };
      setWasm(emit(moduleAst, { globals: new Set(Object.keys(globals)) }));
      setWasmError(null);
    } catch (e) {
      setWasmError(e.message);
    }
  }, [ast, globals]);

  return [wasm, wasmError];
}

function useMod(wasm, globals) {
  const [mod, setMod] = useState(null);

  useEffect(() => {
    setMod(null);
    if (wasm == null) {
      return;
    }
    let unmounted = false;

    modFromWat(wasm, globals).then(mod => {
      if (unmounted) {
        return;
      }
      setMod(mod);
    });

    return () => {
      unmounted = true;
    };
    // We intentionally omit `globals` from this array. When globals updates it
    // should generate a new `wasm` string, and we want to ensure we wait for the
    // new `wasm` rather than trying to build the mod with the old `wasm` and the
    // new `globals`.
  }, [wasm]);

  return mod;
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

function App() {
  const [globals, setGlobals] = useUrlState(
    "globals",
    {},
    { serialize: serializeGlobals, deserialize: deserializeGlobals }
  );
  // const [globals, setGlobals] = useState({});
  const [eel, setEel] = useUrlState("eel", "foo = 1;");
  const [astString, setAstString] = useState(null);
  const [ast, astError] = useAst(eel);
  const [wasm, wasmError] = useWasm(ast, globals);
  const anyErrors = astError != null || wasmError != null;
  const mod = useMod(anyErrors ? null : wasm, globals);
  const forceUpdate = useForceUpdate();

  const run = useMemo(() => {
    if (mod == null) {
      return null;
    }
    return () => {
      mod.exports.main();
      forceUpdate();
    };
  }, [mod]);

  useEffect(() => {
    setAstString(JSON.stringify(ast, null, 2));
  }, [ast]);

  const addGlobal = useCallback(name => {
    setGlobals(globals => {
      return {
        ...globals,
        [name]: new WebAssembly.Global({ value: "f64", mutable: true }, 0)
      };
    });
  }, []);

  // TODO: This currently crashes because we try to create the mod tries to update before the new wasm gets generated.
  const removeGlobal = useCallback(name => {
    setGlobals(globals => {
      const { [name]: _, ...newGlobals } = globals;
      return newGlobals;
    });
  }, []);

  return (
    <div style={{ display: "flex", width: "100vw", alignContent: "stretch" }}>
      <Column>
        <h2>Code</h2>
        <ControlledEditor
          height="40vh"
          width="100%"
          value={eel}
          onChange={(ev, value) => setEel(value)}
          options={EDITOR_OPTIONS}
        />
        <button onClick={run} disabled={run == null}>
          Run
        </button>
        <h2>Globals</h2>
        {Object.entries(globals).map(([name, global]) => {
          return (
            <label key={name}>
              {name}:
              <input
                type="text"
                value={global.value}
                onChange={e => {
                  global.value = Number(e.target.value);
                  forceUpdate();
                }}
              />
              <button onClick={() => removeGlobal(name)}>-</button>
            </label>
          );
        })}
        <button
          onClick={() => {
            const name = window.prompt("Global name?");
            if (name) {
              addGlobal(name);
            }
          }}
        >
          Add Global
        </button>
      </Column>
      <Column>
        <h2>AST</h2>
        {astError != null && <ErrorBlock>{astError}</ErrorBlock>}
        <Editor
          height="90vh"
          width="100%"
          language="json"
          value={astString}
          options={{ ...EDITOR_OPTIONS, readOnly: true }}
        />
      </Column>
      <Column>
        <h2>Wasm</h2>
        {wasmError != null && <ErrorBlock>{wasmError}</ErrorBlock>}
        <Editor
          height="90vh"
          width="100%"
          language="wasm"
          value={wasm}
          options={{ ...EDITOR_OPTIONS, readOnly: true }}
        />
      </Column>
    </div>
  );
}

export default App;
