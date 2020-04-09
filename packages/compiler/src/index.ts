import { parse } from "./parser";
import { compileModule } from "./compiler";
import shims from "./shims";
import { print } from "../tools/prettyPrinter";
import optimizeAst from "./optimizers/optimize";

export { parse, compileModule, shims, print, optimizeAst };
