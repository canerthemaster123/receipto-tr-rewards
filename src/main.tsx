import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './utils/qaHelpers'; // Load QA helpers for E2E tests

createRoot(document.getElementById("root")!).render(<App />);
