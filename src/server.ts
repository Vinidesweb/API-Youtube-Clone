import express from 'express';
import { userRoutes } from './routes/user.routes';
import { videosRoutes } from './routes/videos.routes';
import { config } from 'dotenv';

config();
const app = express();

const cors = require('cors');

app.use(cors({ origin: process.env.FRONT_URL || '*' }));

app.use(express.json());
app.use('/user', userRoutes);
app.use('/videos', videosRoutes);

app.listen(Number(process.env.PORT) || 4000, () => console.log('Servidor rodando'));