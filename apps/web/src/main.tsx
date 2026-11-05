import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("index.html is missing the #root element.");

// Deliberately not wrapped in <StrictMode>: its double-invoked effects would
// boot two Babylon engines and open two WebSocket sessions in development.
createRoot(container).render(<App />);
