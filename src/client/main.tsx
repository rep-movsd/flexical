// Entry point. Mounts the root <App /> into #app. All app code is class-based
// Preact (see src/client/app.tsx).
import { render } from "preact";
import { App } from "./app";
import "./styles.css";

const mount = document.getElementById("app");
if (mount) render(<App />, mount);
