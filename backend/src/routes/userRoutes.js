const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID auto-generado del usuario
 *         nombre:
 *           type: string
 *           description: Nombre completo del usuario
 *         email:
 *           type: string
 *           description: Correo electrónico
 *       example:
 *         id: 1
 *         nombre: Juan Pérez
 *         email: juan@example.com
 */

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API para gestión de usuarios
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lista todos los usuarios
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *   post:
 *     summary: Crea un nuevo usuario
 *     tags: [Users]
 *     responses:
 *       201:
 *         description: Usuario creado
 */
router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Obtiene un usuario por ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Datos del usuario
 *   put:
 *     summary: Actualiza un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *   delete:
 *     summary: Elimina un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado
 */
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

/**
 * @swagger
 * /users/{id}/perfil:
 *   get:
 *     summary: Obtiene el perfil de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *   put:
 *     summary: Actualiza el perfil de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Perfil actualizado
 */
router.get('/:id/perfil', userController.getUserPerfil);
router.put('/:id/perfil', userController.updateUserPerfil);

/**
 * @swagger
 * /users/{id}/especialidades:
 *   get:
 *     summary: Obtiene las especialidades de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de especialidades
 *   put:
 *     summary: Actualiza las especialidades de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Especialidades actualizadas
 */
router.get('/:id/especialidades', userController.getUserEspecialidades);
router.put('/:id/especialidades', userController.updateUserEspecialidades);

/**
 * @swagger
 * /users/{id}/estudios:
 *   get:
 *     summary: Obtiene los estudios de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de estudios
 *   post:
 *     summary: Agrega o actualiza un estudio de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Estudio actualizado
 */
router.get('/:id/estudios', userController.getUserEstudios);
router.post('/:id/estudios', userController.upsertUserEstudio);

/**
 * @swagger
 * /users/{id}/disponibilidad:
 *   get:
 *     summary: Obtiene la disponibilidad de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de disponibilidades
 *   post:
 *     summary: Agrega un bloque de disponibilidad para un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Disponibilidad agregada
 */
router.get('/:id/disponibilidad', userController.getUserDisponibilidad);
router.post('/:id/disponibilidad', userController.addUserDisponibilidad);

/**
 * @swagger
 * /users/{id}/disponibilidad/{slotId}:
 *   delete:
 *     summary: Elimina un bloque de disponibilidad
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *       - in: path
 *         name: slotId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del bloque de disponibilidad
 *     responses:
 *       200:
 *         description: Bloque eliminado
 */
router.delete('/:id/disponibilidad/:slotId', userController.deleteUserDisponibilidad);

module.exports = router;