import React, { useEffect, useState } from "react";
import "./App.css";
import { parse } from "parser";
import { emit } from "emitter";
import Editor, { ControlledEditor } from "@monaco-editor/react";
import { useUrlState } from "./hooks";

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

function App() {
  const [eel, setEel] = useUrlState("eel", "foo = 1;");
  const [ast, setAst] = useState(null);
  const [astString, setAstString] = useState(null);
  const [astError, setAstError] = useState(null);
  const [wasm, setWasm] = useState(null);
  const [wasmError, setWasmError] = useState(null);

  useEffect(() => {
    try {
      setAst(parse(eel));
      setAstError(null);
    } catch (e) {
      setAstError(e.message);
    }
  }, [eel]);
  useEffect(() => {
    setAstString(JSON.stringify(ast, null, 2));
  }, [ast]);
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
      setWasm(emit(moduleAst, { globals: new Set() }));
      setWasmError(null);
    } catch (e) {
      setWasmError(e.message);
    }
  }, [ast]);
  return (
    <div style={{ display: "flex", width: "100vw", alignContent: "stretch" }}>
      <Column>
        <h2>Code</h2>
        <ControlledEditor
          height="90vh"
          width="100%"
          value={eel}
          onChange={(ev, value) => setEel(value)}
        />
      </Column>
      <Column>
        <h2>AST</h2>
        {astError != null && <ErrorBlock>{astError}</ErrorBlock>}
        <Editor height="90vh" width="100%" language="json" value={astString} />
      </Column>
      <Column>
        <h2>Wasm</h2>
        {wasmError != null && <ErrorBlock>{wasmError}</ErrorBlock>}
        <Editor height="90vh" width="100%" language="wasm" value={wasm} />
      </Column>
    </div>
  );
}

export default App;
