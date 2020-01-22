import React, { useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { parse } from "parser";
import { emit } from "emitter";

const { useState, useMemo } = React;

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

function App() {
  const [eel, setEel] = useState("foo = 1;");
  const [ast, setAst] = useState(null);
  const [wasm, setWasm] = useState(null);
  useEffect(() => {
    try {
      setAst(parse(eel));
    } catch (e) {
      // setAst(null);
    }
  }, [eel]);
  useEffect(() => {
    if (ast == null) {
      // setWasm("Empty");
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
    } catch (e) {
      console.error(e);
      // setWasm(e.toString());
    }
  }, [ast]);
  return (
    <div style={{ display: "flex", width: "100vw", alignContent: "stretch" }}>
      <Column>
        <h2>Code</h2>
        <textarea value={eel} onChange={e => setEel(e.target.value)} />
      </Column>
      <Column>
        <h2>AST</h2>
        <pre>{JSON.stringify(ast, null, 2)}</pre>
      </Column>
      <Column>
        <h2>Wasm</h2>
        <pre>{wasm}</pre>
      </Column>
    </div>
  );
}

export default App;
