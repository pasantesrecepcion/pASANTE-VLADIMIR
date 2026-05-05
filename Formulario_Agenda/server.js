const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`
    -----------------------------------------
    🚀 AGENDA B100 ACTIVA (FORMULARIO)
    🔗 http://localhost:${PORT}
    -----------------------------------------
    `);
});
