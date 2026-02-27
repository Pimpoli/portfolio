const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Permitir que tu portafolio se conecte a este servidor
app.use(cors());
app.use(express.json());

// Endpoint para obtener la presencia (Estado: Online, Studio, InGame)
app.post('/presence', async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !userIds.length) {
      return res.status(400).json({ error: 'No userIds provided' });
    }

    // Consultamos a la API oficial de Roblox
    const response = await axios.post('https://presence.roblox.com/v1/presence/users', {
      userIds: userIds
    });

    // Devolvemos la respuesta tal cual al portafolio
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching presence:', error.message);
    res.status(500).json({ error: 'Failed to fetch presence' });
  }
});

// Endpoint para avatar: Devuelve el JSON con la URL de la imagen (evita problemas de streaming)
app.get('/avatar/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    // Consultamos la API de Roblox y devolvemos el JSON tal cual al cliente
    const response = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching avatar data:', error.message);
    res.status(500).json({ error: 'Failed to fetch avatar data' });
  }
});

app.listen(PORT, () => {
  console.log(`
  🚀 Servidor Proxy de Roblox corriendo en http://localhost:${PORT}
  
  Para ver el estado en tu portafolio:
  1. Asegúrate de tener instalado Node.js
  2. Instala las dependencias: npm install express cors axios
  3. Mantén esta ventana abierta mientras usas el portafolio.
  `);
});
