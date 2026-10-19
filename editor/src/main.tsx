import React from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "./Editor";
import { ToastProvider } from "./toast";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <Editor />
    </ToastProvider>
  </React.StrictMode>
);
