// Dev:  VITE_API_URL is undefined → Vite proxy forwards /api/* to localhost:8000
// Prod: VITE_API_URL = 'https://spectra-backend.onrender.com'
export const API = import.meta.env.VITE_API_URL ?? '/api'
