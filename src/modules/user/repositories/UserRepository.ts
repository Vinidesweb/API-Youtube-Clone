import { pool } from '../../../mysql';
import { v4 as uuidv4 } from 'uuid';
import { hash, compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { Request, Response } from 'express';
import { verify } from 'jsonwebtoken';

class UserRepository {
  create(request: Request, response: Response){
        const { name, email, password } = request.body;

        if (!name || !email || !password) {
            return response.status(400).json({ error: 'Preencha todos os campos.' });
        }

        pool.getConnection((err: any, connection: any) => {
            if (err) {
                return response.status(500).json({ error: 'Erro ao conectar com o banco' });
            }

            hash(password, 10, (errHash, hashed) => {
                if (errHash) {
                    connection.release();
                    return response.status(500).json({ error: 'Erro ao processar a senha' });
                }

                connection.query(
                    'INSERT INTO users (users_id, name, email, password) VALUES (?, ?, ?, ?)',
                    [uuidv4(), name, email, hashed],
                    (error: any) => {
                        connection.release();
                        if (error) {
                            if (error.code === 'ER_DUP_ENTRY') {
                                return response.status(409).json({ error: 'E-mail já cadastrado.' });
                            }
                            return response.status(400).json({ error: 'Não foi possível criar a conta.' });
                        }
                        return response.status(200).json({ message: 'Usuário criado com sucesso' });
                    }
                )
            })
        })
    }

  login(request: Request, response: Response){
    const { email, password } = request.body;
    pool.getConnection((err: any, connection: any) => {
        if (err) {
            return response.status(500).json({ error: 'Erro ao conectar com o banco' });
        }

        connection.query(
            'SELECT * FROM users WHERE email = ?',
            [email],
            (error: any, results: any) => {
                connection.release();

                if (error) {
                    return response.status(400).json({ error: 'Erro na sua autenticação!' });
                }

                if (!results || results.length === 0) {
                    return response.status(401).json({ error: 'Email ou senha inválidos' });
                }

                compare(password, results[0].password, (err, result) => {
                    if (err) {
                        return response.status(400).json({ error: 'Erro na sua autenticação!' });
                    }

                    if (!result) {
                        return response.status(401).json({ error: 'Email ou senha inválidos' });
                    }

                    const token = sign(
                        { id: results[0].users_id, email: results[0].email },
                        process.env.SECRET as string,
                        { expiresIn: '1d' }
                    );

                    return response.status(200).json({ token, message: 'Autenticado com sucesso!' });
                });
            }
        );
    });
}

    getUser(request: Request, response: Response){
        try {
            const token = request.headers.authorization;
            if (!token) {
                return response.status(401).json({ error: 'Token não informado' });
            }

            const decode: any = verify(token, process.env.SECRET as string);

            pool.getConnection((err: any, conn: any) => {
                if (err) {
                    return response.status(500).json({ error: 'Erro ao conectar com o banco' });
                }

                conn.query(
                    'SELECT * FROM users WHERE email = ?',
                    [decode.email],
                    (error: any, resultado: any) => {
                        conn.release();

                        if (error) {
                            return response.status(400).json({ error: error, response: null });
                        }

                        if (!resultado || resultado.length === 0) {
                            return response.status(404).json({ error: 'Usuário não encontrado' });
                        }

                        return response.status(200).json({
                            user: {
                                nome: resultado[0].name,
                                email: resultado[0].email,
                                id: resultado[0].users_id
                            }
                        });
                    }
                );
            });
        } catch (e) {
            return response.status(401).json({ error: 'Token inválido ou expirado' });
        }
    }
}

export { UserRepository };