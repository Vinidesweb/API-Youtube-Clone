import { enrichVideos, getVideoId, fetchYoutubeVideos } from '../services/youtube';
import { pool } from '../../../mysql';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

class VideoRepository {
    async create(request: Request, response: Response){
        const user_id = (request as any).user.id;
        const { url } = request.body;

        const videoId = getVideoId(url ?? '');
        if (!videoId) {
            return response.status(400).json({ error: 'URL inválida. Use um link do YouTube.' });
        }

        let info: any;
        try {
            info = (await fetchYoutubeVideos([videoId]))[videoId];
        } catch {
            return response.status(502).json({ error: 'Não foi possível consultar o YouTube.' });
        }
        if (!info) {
            return response.status(404).json({ error: 'Vídeo não encontrado no YouTube.' });
        }

        pool.getConnection((err: any, connection: any) => {
            if (err) {
                return response.status(500).json({ error: 'Erro ao conectar com o banco' });
            }

            connection.query(
                'INSERT INTO videos (video_id, user_id, title, description, url) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), user_id, info.snippet.title, info.snippet.description, url],
                (error: any) => {
                    connection.release();
                    if (error) {
                        return response.status(400).json(error);
                    }
                    response.status(200).json({ message: 'Video criado com sucesso' });
                }
            )
        })
    }

    getAllVideos(request: Request, response: Response){
        pool.getConnection((err: any, connection: any) => {
            if (err) {
                return response.status(500).json({ error: 'Erro ao conectar com o banco', code: err.code });
            }

            connection.query(
                'SELECT * FROM videos',
                async (error: any, results: any) => {
                    connection.release();
                    if (error) {
                        return response.status(400).json({ error: 'Erro ao buscar os videos!' });
                    }

                    const videos = await enrichVideos(results);
                    return response.status(200).json({ message: 'Videos retornados com sucesso', videos });
                }
            )
        })
    }

    getVideos(request: Request, response: Response){
        const userId = (request as any).user.id;

        pool.getConnection((err: any, connection: any) => {
            if (err) {
                return response.status(500).json({ error: 'Erro ao conectar com o banco' });
            }

            connection.query(
                'SELECT * FROM videos WHERE user_id = ?',
                [userId],
                async (error: any, results: any) => {
                    connection.release();
                    if (error) {
                        return response.status(400).json({ error: 'Erro ao buscar os videos!' });
                    }
                    return response.status(200).json({
                        message: 'Videos retornados com sucesso',
                        videos: await enrichVideos(results),
                    });
                }
            );
        });
    }

    searchVideos(request: Request, response: Response){
        const { search } = request.query;

        pool.getConnection((err: any, connection: any) => {
            if (err) {
                return response.status(500).json({ error: 'Erro ao conectar com o banco' });
            }

            connection.query(
                'SELECT * FROM videos WHERE title LIKE ? OR description LIKE ?',
                [`%${search}%`, `%${search}%`],
                async (error: any, results: any) => {
                    connection.release();
                    if (error) {
                        return response.status(400).json({ error: 'Erro ao buscar os videos!' });
                    }
                    return response.status(200).json({
                        message: 'Videos retornados com sucesso',
                        videos: await enrichVideos(results),
                    });
                }
            );
        });
    }
}

export { VideoRepository };