const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API para gestión de usuarios y perfiles de abogado
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Descripción del error"
 *
 *     SuccessMessage:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operación realizada correctamente"
 *
 *     Persona:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 25 }
 *         dni: { type: string, example: "45678912" }
 *         telefono: { type: string, nullable: true, example: "+51 987654321" }
 *         correo: { type: string, example: "juan@example.com" }
 *         primer_nombre: { type: string, example: "Juan" }
 *         segundo_nombre: { type: string, nullable: true, example: "Carlos" }
 *         apellido_paterno: { type: string, example: "Pérez" }
 *         apellido_materno: { type: string, nullable: true, example: "García" }
 *         direccion: { type: string, nullable: true, example: "Av. Principal 123" }
 *
 *     Role:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 3 }
 *         codigo: { type: string, example: "abogado" }
 *         nombre: { type: string, example: "Abogado" }
 *
 *     PerfilAbogado:
 *       type: object
 *       properties:
 *         usuario_id: { type: integer, example: 51 }
 *         tarifa_base: { type: number, nullable: true, example: 150.00 }
 *         duracion_minutos: { type: integer, example: 60 }
 *         direccion_atencion: { type: string, nullable: true, example: "Calle Falsa 123" }
 *         bio: { type: string, nullable: true, example: "Abogado especialista en civil" }
 *         place_id_api: { type: string, nullable: true, example: "ChIJKx..." }
 *         disponibilidadabogado:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DisponibilidadSlot'
 *         especialidades:
 *           description: En respuestas, se aplana a objetos `Especialidad` (no los pivotes).
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Especialidad'
 *
 *     Especialidad:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 7 }
 *         nombre: { type: string, example: "Derecho Civil" }
 *
 *     Estudio:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 12 }
 *         ruc: { type: string, nullable: true, example: "20601234567" }
 *         nombre_comercial: { type: string, nullable: true, example: "Estudio Legal Rivera" }
 *         pais: { type: string, nullable: true, example: "Perú" }
 *         ciudad: { type: string, nullable: true, example: "Lima" }
 *         correo_contacto: { type: string, nullable: true, example: "contacto@riveralegal.pe" }
 *         telefono: { type: string, nullable: true, example: "+51 1 555-1234" }
 *         direccion: { type: string, nullable: true, example: "Av. Principal 123, Miraflores" }
 *         activo: { type: boolean, example: true }
 *
 *     AbogadoEstudio:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 33 }
 *         usuario_id: { type: integer, example: 51 }
 *         estudio_id: { type: integer, example: 12 }
 *         principal: { type: boolean, example: true }
 *         rol_en_estudio: { type: string, nullable: true, example: "Socio" }
 *         activo: { type: boolean, example: true }
 *         estudio:
 *           $ref: '#/components/schemas/Estudio'
 *
 *     DisponibilidadSlot:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1001 }
 *         abogado_id: { type: integer, example: 51 }
 *         dia_semana:
 *           type: integer
 *           description: 1=Lunes ... 7=Domingo
 *           example: 1
 *         hora_inicio:
 *           type: string
 *           format: time
 *           example: "09:00:00"
 *         hora_fin:
 *           type: string
 *           format: time
 *           example: "12:00:00"
 *
 *     Usuario:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 51 }
 *         persona_id: { type: integer, example: 25 }
 *         rol_id: { type: integer, example: 3 }
 *         clave: { type: string, example: "hash/clave" }
 *         telefono_verificado: { type: boolean, example: false }
 *         plan_id: { type: integer, nullable: true, example: null }
 *         almacenamiento_usado: { type: integer, example: 0 }
 *         creado_el: { type: string, format: date-time, example: "2025-09-15T12:34:56.000Z" }
 *         activo: { type: boolean, example: true }
 *         persona:
 *           $ref: '#/components/schemas/Persona'
 *         role:
 *           $ref: '#/components/schemas/Role'
 *         perfilabogado:
 *           nullable: true
 *           $ref: '#/components/schemas/PerfilAbogado'
 *         abogadoestudios:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AbogadoEstudio'
 *
 *     UsuarioExpandedResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         user:
 *           $ref: '#/components/schemas/Usuario'
 *
 *     UsersList:
 *       type: array
 *       items:
 *         $ref: '#/components/schemas/Usuario'
 *
 *     CreateUserRequest:
 *       type: object
 *       required: [rol_id, clave]
 *       properties:
 *         attachToExisting:
 *           type: boolean
 *           default: false
 *         rol_id:
 *           type: integer
 *           example: 3
 *         clave:
 *           type: string
 *           description: Hash/contraseña (debe hashearse en servicio)
 *           example: "MiClaveSegura#2024"
 *         persona:
 *           description: Requerida si attachToExisting=false; si attachToExisting=true se usa para buscar por dni/correo.
 *           type: object
 *           properties:
 *             dni: { type: string, example: "45678912" }
 *             telefono: { type: string, example: "+51 987654321" }
 *             correo: { type: string, example: "juan@example.com" }
 *             primer_nombre: { type: string, example: "Juan" }
 *             segundo_nombre: { type: string, nullable: true, example: "Carlos" }
 *             apellido_paterno: { type: string, example: "Pérez" }
 *             apellido_materno: { type: string, nullable: true, example: "García" }
 *             direccion: { type: string, nullable: true, example: "Av. 123" }
 *
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         rol_id: { type: integer, example: 1 }
 *         persona:
 *           $ref: '#/components/schemas/Persona'
 *
 *     UpdatePerfilRequest:
 *       type: object
 *       properties:
 *         tarifa_base: { type: number, nullable: true, example: 150 }
 *         duracion_minutos: { type: integer, example: 60 }
 *         direccion_atencion: { type: string, nullable: true, example: "Calle Falsa 123" }
 *         bio: { type: string, nullable: true, example: "Abogado con 10 años de experiencia." }
 *
 *     UpdateEspecialidadesRequest:
 *       type: object
 *       properties:
 *         ids:
 *           type: array
 *           items: { type: integer }
 *           example: [1, 5, 7]
 *
 *     UpsertUserEstudioRequest:
 *       type: object
 *       required: [estudio_id]
 *       properties:
 *         estudio_id: { type: integer, example: 12 }
 *         principal: { type: boolean, example: true }
 *         rol_en_estudio: { type: string, nullable: true, example: "Asociado Senior" }
 *
 *     AddDisponibilidadRequest:
 *       type: object
 *       required: [dia_semana, hora_inicio, hora_fin]
 *       properties:
 *         dia_semana:
 *           type: integer
 *           description: 1=Lunes ... 7=Domingo
 *           example: 1
 *         hora_inicio:
 *           type: string
 *           description: Formato HH:mm
 *           example: "09:00"
 *         hora_fin:
 *           type: string
 *           description: Formato HH:mm
 *           example: "12:00"
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lista todos los usuarios
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios (con persona, rol, perfil y estudios activos)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersList'
 *       500:
 *         description: Error obteniendo usuarios
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   post:
 *     summary: Crea un nuevo usuario (o agrega un rol a persona existente)
 *     description: |
 *       - Si `attachToExisting=true`, se adjunta una nueva cuenta (rol) a una persona existente (buscando por DNI/correo).
 *       - Si `attachToExisting=false`, crea persona + usuario.
 *       - El panel administrativo no acepta payloads de abogado en este recurso; cualquier campo relacionado a perfil de abogado será rechazado.
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: Usuario creado (estructura expandida)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Usuario creado exitosamente" }
 *                 user:
 *                   $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: Campos faltantes o DNI inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Persona no encontrada (en modo attachToExisting)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Conflicto (rol duplicado o DNI/correo inconsistente)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);

/**
 * @swagger
 * /users/persona/conflicts:
 *   get:
 *     summary: Verifica duplicados de persona por DNI, teléfono o correo
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: dni
 *         schema:
 *           type: string
 *         required: false
 *         description: DNI a validar
 *       - in: query
 *         name: telefono
 *         schema:
 *           type: string
 *         required: false
 *         description: Teléfono a validar
 *       - in: query
 *         name: correo
 *         schema:
 *           type: string
 *         required: false
 *         description: Correo electrónico a validar
 *     responses:
 *       200:
 *         description: Resultado de la validación
 */
router.get('/persona/conflicts', userController.checkPersonaConflicts);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Obtiene un usuario por ID
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsuarioExpandedResponse'
 *       400:
 *         description: ID inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   put:
 *     summary: Actualiza un usuario (persona, rol y/o perfil de abogado)
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Usuario actualizado exitosamente" }
 *                 user: { $ref: '#/components/schemas/Usuario' }
 *       400:
 *         description: Datos inválidos (DNI/Email duplicados)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Conflicto (rol duplicado para la persona)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   delete:
 *     summary: Elimina un usuario (y la persona si no quedan más cuentas)
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessMessage' }
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.patch('/:id/activo', userController.setUserActive);
router.delete('/:id', userController.deleteUser);

/**
 * @swagger
 * /users/{id}/perfil:
 *   get:
 *     summary: Obtiene el perfil de abogado del usuario
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Perfil encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PerfilAbogado' }
 *       404:
 *         description: Perfil de abogado no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   put:
 *     summary: Crea/actualiza el perfil de abogado del usuario
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdatePerfilRequest' }
 *     responses:
 *       200:
 *         description: Perfil guardado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 perfil: { $ref: '#/components/schemas/PerfilAbogado' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id/perfil', userController.getUserPerfil);
router.put('/:id/perfil', userController.updateUserPerfil);

/**
 * @swagger
 * /users/{id}/especialidades:
 *   get:
 *     summary: Lista las especialidades del usuario (abogado)
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de especialidades (id, nombre)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Especialidad' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   put:
 *     summary: Reemplaza las especialidades del usuario (por IDs)
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateEspecialidadesRequest' }
 *           example: { "ids": [1, 5, 7] }
 *     responses:
 *       200:
 *         description: Especialidades actualizadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 ids:
 *                   type: array
 *                   items: { type: integer }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id/especialidades', userController.getUserEspecialidades);
router.put('/:id/especialidades', userController.updateUserEspecialidades);

/**
 * @swagger
 * /users/{id}/estudios:
 *   get:
 *     summary: Obtiene los estudios vinculados al usuario (activos, principal primero)
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de vínculos usuario-estudio
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/AbogadoEstudio' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   post:
 *     summary: Crea/actualiza el vínculo del usuario con un estudio
 *     description: Si `principal=true`, desmarca los demás vínculos como no principales.
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpsertUserEstudioRequest' }
 *     responses:
 *       200:
 *         description: Vínculo guardado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 vinculo: { $ref: '#/components/schemas/AbogadoEstudio' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id/estudios', userController.getUserEstudios);
router.post('/:id/estudios', userController.upsertUserEstudio);
/**
 * @swagger
 * /users/{id}/estudios/{estudioId}:
 *   delete:
 *     summary: Elimina (desactiva) el vínculo entre el usuario y un estudio
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: estudioId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vínculo desactivado
 *       404:
 *         description: Vínculo no encontrado
 */
router.delete('/:id/estudios/:estudioId', userController.deleteUserEstudio);

/**
 * @swagger
 * /users/{id}/disponibilidad:
 *   get:
 *     summary: Obtiene la disponibilidad del abogado
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de bloques de disponibilidad
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/DisponibilidadSlot' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   post:
 *     summary: Agrega un bloque de disponibilidad
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AddDisponibilidadRequest' }
 *     responses:
 *       201:
 *         description: Bloque creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 slot: { $ref: '#/components/schemas/DisponibilidadSlot' }
 *       400:
 *         description: Datos inválidos (día u horas)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: El usuario no tiene perfil de abogado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Horario ya registrado (índice único de disponibilidad)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id/disponibilidad', userController.getUserDisponibilidad);
router.post('/:id/disponibilidad', userController.addUserDisponibilidad);

/**
 * @swagger
 * /users/{id}/disponibilidad/{slotId}:
 *   delete:
 *     summary: Elimina un bloque de disponibilidad
 *     tags: [Users]
 *     # security:
 *     #   - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Bloque eliminado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessMessage' }
 *       404:
 *         description: Horario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/:id/disponibilidad/:slotId', userController.deleteUserDisponibilidad);

module.exports = router;