const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// SOLO rutas de usuarios
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

router.get('/:id/perfil', userController.getUserPerfil);
router.put('/:id/perfil', userController.updateUserPerfil);
router.get('/:id/especialidades', userController.getUserEspecialidades);
router.put('/:id/especialidades', userController.updateUserEspecialidades);
router.get('/:id/estudios', userController.getUserEstudios);
router.post('/:id/estudios', userController.upsertUserEstudio);
router.get('/:id/disponibilidad', userController.getUserDisponibilidad);
router.post('/:id/disponibilidad', userController.addUserDisponibilidad);
router.delete('/:id/disponibilidad/:slotId', userController.deleteUserDisponibilidad);
module.exports = router;
