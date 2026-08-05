import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

import 'leaflet/dist/leaflet.css';
import './index.css';

// Fix Leaflet's default marker icons under the Vite bundler (assets bundled locally, no CDN).
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
