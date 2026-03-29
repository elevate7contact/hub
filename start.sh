#!/bin/bash
echo "🚀 Iniciando HUB - Centro de Proyectos..."

# Start backend
cd "$(dirname "$0")/backend"
node --experimental-sqlite src/app.js &
BACKEND_PID=$!
echo "✅ Backend iniciado (PID: $BACKEND_PID) → http://localhost:3001"

# Start frontend
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend iniciado (PID: $FRONTEND_PID) → http://localhost:5173"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HUB corriendo en: http://localhost:5173"
echo "  Login: juan@hub.com / admin123"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Presiona Ctrl+C para detener todo"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
