import { Request, Response } from "express";
import getUserByIdDB from "../functions/userFunctions";
import prisma from "../database";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
  ApiError,
} from "../helpers/api-erros"; // Importe os tipos corretos de erros

class UserController {
  updateUser(req: Request, res: Response) {
    const { nome, email, cargo, data_nasc, senha, url } = req.body;
    const id = req.params.id;
    const userId = parseInt(id, 10);

    const token = req.headers.authorization;
    if (!token) {
      throw new UnauthorizedError("Token não fornecido");
    }

    jwt.verify(token, process.env.JWT_PASS ?? "", (err, decoded) => {
      if (err) {
        console.error(err);
        throw new UnauthorizedError("Token inválido");
      }

      getUserByIdDB(userId, res).then((user) => {
        const newEmail = email === user.email ? user.email : email;
        prisma.user
          .findUnique({
            where: { email: newEmail },
          })
          .then((existingUser) => {
            if (existingUser && existingUser.id !== userId) {
              throw new BadRequestError("Já existe um usuário com este email");
            }
            const newName = nome || user.nome;

            const newDataNasc = data_nasc || user.data_nasc;

            const newSenha = senha ? bcrypt.hashSync(senha, 10) : user.senha;

            const newUrl = url || user.foto_perfil;

            prisma.user
              .update({
                where: {
                  id: userId,
                },
                data: {
                  cargo,
                  nome: newName,
                  email: newEmail,
                  data_nasc: newDataNasc,
                  senha: newSenha,
                  foto_perfil: newUrl,
                },
              })
              .then((updatedUser) => {
                const { senha: _, ...userLogin } = updatedUser;
                res.status(200).json({
                  message: "Usuário atualizado com sucesso!",
                  user: userLogin,
                });
              })
              .catch((error) => {
                console.error(error);
                throw new ApiError("Não foi possível atualizar o usuário", 500);
              });
          });
      });
    });
  }

  createUser(req: Request, res: Response) {
    const { nome, email, senha, data_nasc } = req.body;

    prisma.user
      .findUnique({
        where: {
          email,
        },
      })
      .then((user) => {
        if (user) {
          throw new BadRequestError("Já existe um usuário com esse email");
        } else {
          bcrypt.hash(senha, 10).then((hashPassword: string) => {
            prisma.user
              .create({
                data: {
                  nome,
                  email,
                  senha: hashPassword,
                  data_nasc,
                },
              })
              .then(() => {
                res.status(201).json("Usuário criado com sucesso");
              });
          });
        }
      }).catch((error) => {
        // Trate o erro aqui e envie uma resposta apropriada
        if (error instanceof BadRequestError) {
          res.status(400).json({ Error: error.message });
        } else {
          console.error(error);
          res.status(500).json({ Error: "Erro interno do servidor" });
        }
      });
  }

  login(req: Request, res: Response) {
    const { email, senha } = req.body;

    prisma.user
      .findUnique({ where: { email } })
      .then((user) => {
        if (user) {
          bcrypt.compare(senha, user.senha).then((verifyPass) => {
            if (verifyPass) {
              const token = jwt.sign(
                { id: user.id, cargo: user.cargo },
                process.env.JWT_PASS ?? "",
                {
                  expiresIn: "8h",
                }
              );

              const { senha: _, ...userLogin } = user;

              res.status(200).json({
                user: userLogin,
                token: token,
              });
            } else {
              throw new BadRequestError("Senha incorreta");
            }
          });
        } else {
          throw new NotFoundError("Usuário não encontrado");
        }
      })
      .catch((error) => {
        console.error(error);
        throw new ApiError("Erro ao autenticar o usuário", 500);
      });
  }

  getUserById(req: Request, res: Response) {
    const idUser = req.params.id;
    const userId = parseInt(idUser, 10);

    getUserByIdDB(userId, res)
      .then((user) => {
        if (user) {
          res.status(200).json(user);
        } else {
          throw new NotFoundError("Usuário não encontrado");
        }
      })
      .catch((error) => {
        console.error(error);
        throw new ApiError("Erro ao buscar o usuário", 500);
      });
  }
}

export default new UserController();