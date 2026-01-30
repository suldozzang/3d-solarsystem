import React from 'react';
import ReactDOM from 'react-dom/client';
import SolarSystem from './solar-system'; // 경로 수정됨

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SolarSystem />
  </React.StrictMode>
);
