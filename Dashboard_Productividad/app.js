const http = require('http');
const fs = require('fs');
const path = require('path');

// URL Empresarial Ocupando la Raíz
const DATABASE_URL = 'https://logistica-b100-default-rtdb.firebaseio.com/.json';

async function getFirebaseData() {
    try {
        const response = await fetch(DATABASE_URL);
        return await response.json();
    } catch (error) {
        return null;
    }
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'style.css'), (err, data) => {
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    } else if (req.url === '/dashboard.js') {
        fs.readFile(path.join(__dirname, 'dashboard.js'), (err, data) => {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } else if (req.url === '/api/data') {
        const data = await getFirebaseData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
});

server.listen(3000, () => {
    console.log('🚀 SERVIDOR VLADY ACTIVO');
    console.log('🔗 Abre en Chrome: http://localhost:3000');
});