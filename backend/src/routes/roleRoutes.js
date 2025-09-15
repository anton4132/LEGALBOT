const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID del rol
 *         nombre:
 *           type: string
 *           description: Nombre del rol
 *       example:
 *         id: 1
 *         nombre: Admin
 */

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Gestión de roles de usuario
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Lista todos los roles
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: Lista de roles
 */
router.get('/', roleController.getAllRoles);

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Obtiene un rol por ID
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del rol
 *     responses:
 *       200:
 *         description: Rol obtenido
 */
router.get('/:id', roleController.getRoleById);

module.exports = router;