import { BrowserRouter, HashRouter } from "react-router-dom";
import StreamButed from "./StreamButed";
import { AppProviders } from "./app/AppProviders";

const Router = globalThis.window.location.protocol === "file:" ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <AppProviders>
        <StreamButed />
      </AppProviders>
    </Router>
  );
}
