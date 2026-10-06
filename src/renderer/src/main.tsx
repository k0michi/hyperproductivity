import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppStore } from './appStore'
import { StoreProvider } from './store'
import './base.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider create={() => new AppStore()}>
      <App />
    </StoreProvider>
  </React.StrictMode>,
)
