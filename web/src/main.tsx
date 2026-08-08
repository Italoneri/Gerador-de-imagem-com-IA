import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/tokens.css";

const host = document.getElementById("root");
if (!host) throw new Error("elemento #root não encontrado no index.html");

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
