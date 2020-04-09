import React, { useEffect, useState, useMemo } from "react";
import "./App.css";
import Editor, { ControlledEditor, DiffEditor } from "@monaco-editor/react";
import {
  useUrlState,
  useForceUpdate,
  useGlobals,
  useAst,
  useWasm,
  useWat,
  useMod,
  useOptimizedAst,
  usePrettyPrintedEel,
} from "./hooks";

function Column({ children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        flexBasis: 0,
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
  lineNumbers: "off",
};

function App() {
  const [optimize, setOptimize] = useUrlState("optimize", false, {
    serialize: bool => (bool ? 1 : 0),
    deserialize: val => Boolean(Number(val)),
  });
  const { globals, addGlobal, removeGlobal } = useGlobals();
  const [eel, setEel] = useUrlState("eel", "foo = 1;");
  const [astString, setAstString] = useState(null);
  const [ast, astError] = useAst(eel);
  const optimizedAst = useOptimizedAst(ast, optimize);
  const prettyEel = usePrettyPrintedEel(ast);
  const optimizedEel = usePrettyPrintedEel(optimizedAst);
  const [wasm, wasmError] = useWasm(optimizedAst, globals);
  const [wat] = useWat(wasm);
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
  }, [forceUpdate, mod]);

  useEffect(() => {
    setAstString(JSON.stringify(optimizedAst, null, 2));
  }, [optimizedAst]);

  return (
    <div style={{ display: "flex", width: "100vw", alignContent: "stretch" }}>
      <div
        style={{
          position: "absolute",
          top: "0",
          right: "0",
          marginTop: "10px",
          marginRight: "10px",
        }}
      >
        <a href="https://github.com/captbaritone/eel-wasm">GitHub</a>
      </div>
      <Column>
        <h2>Code</h2>
        <ControlledEditor
          height="40vh"
          width="100%"
          value={eel}
          onChange={(ev, value) => setEel(value)}
          options={{ ...EDITOR_OPTIONS, lineNumbers: "on" }}
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
              <button onClick={() => removeGlobal(name)}>X</button>
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
        <label>
          Optimize{" "}
          <input
            type="checkbox"
            checked={optimize}
            onChange={e => {
              setOptimize(e.target.checked);
            }}
          />
        </label>
        {astError != null && <ErrorBlock>{astError}</ErrorBlock>}
        <Editor
          height={optimize ? "40vh" : "90vh"}
          width="100%"
          language="json"
          value={astString}
          options={{ ...EDITOR_OPTIONS, readOnly: true }}
        />
        {optimize && (
          <>
            <h2>Optimization Changes</h2>
            <DiffEditor
              height="40vh"
              width="100%"
              original={prettyEel}
              modified={optimizedEel}
              options={{
                ...EDITOR_OPTIONS,
                lineNumbers: "on",
                readOnly: true,
              }}
            />
          </>
        )}
      </Column>
      <Column>
        <h2>Wasm</h2>
        {wasmError != null && <ErrorBlock>{wasmError}</ErrorBlock>}
        <Editor
          height="90vh"
          width="100%"
          language="wasm"
          value={wat}
          options={{ ...EDITOR_OPTIONS, readOnly: true }}
        />
      </Column>
    </div>
  );
}

export default App;
