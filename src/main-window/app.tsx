import { createRoot } from "react-dom/client";
import { MemoryRouter as Router, Routes, Route } from "react-router";
import FileSelection from "./pages/FileSelection";
import FilePreview from "./pages/FilePreview";
import AlgorithmSettings from "./pages/AlgorithmSettings";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FileSelection />} />
        <Route path="/file_preview" element={<FilePreview />} />
        <Route path="/algorithm_settings" element={<AlgorithmSettings />} />
      </Routes>
    </Router>
  );
};

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(<App />);
