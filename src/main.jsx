import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import AccountApp from './account/AccountApp.jsx'
import { track } from './track.js'

const path = window.location.pathname
const view = path.startsWith('/admin') ? 'admin' : path.startsWith('/account') ? 'account' : 'site'

if (view === 'site') track()

const root = view === 'admin' ? <AdminApp /> : view === 'account' ? <AccountApp /> : <App />

createRoot(document.getElementById('root')).render(<StrictMode>{root}</StrictMode>)
