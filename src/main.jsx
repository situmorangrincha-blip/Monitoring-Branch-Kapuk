import { createRoot } from 'react-dom/client';
import '@fontsource/quicksand/400.css';
import '@fontsource/quicksand/500.css';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
import App from './App.jsx';
import { applyFs } from './lib/unit.js';
import './styles.css';
import './theme.css';

applyFs();
createRoot(document.getElementById('root')).render(<App />);
