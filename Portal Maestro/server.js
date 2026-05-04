const express = require('express');
const path = require('path');
const app = express();

// Puerto solicitado
const PORT = 3004;

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
    -------------------------------------------
    🚀 PORTAL MAESTRO ACTIVADO
    📍 URL: http://localhost:${PORT}
    🏭 CEDIS: Santa Cruz, Bolivia
    -------------------------------------------
    `);
});