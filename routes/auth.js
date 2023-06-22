const express = require('express');

const authController = require('../controllers/auth');

const router = express.Router();

router.post('/auth/postBusinessSignUp', authController.postBusinessSignUp);
router.post('/auth/postBusinessSignIn', authController.postBusinessSignIn);
router.post('/auth/postBusinessSignOut', authController.postBusinessSignOut);
router.post('/auth/getBusinessAccessToken', authController.getBusinessAccessToken);
router.post('/auth/postBusinessPassword', authController.postBusinessPassword);
router.post('/auth/postChangeLanguage', authController.postChangeLanguage);
router.post('/auth/postPushToken', authController.postPushToken);
router.post('/auth/getEmail', authController.getEmail);
router.post('/auth/postBusinessEmail', authController.postBusinessEmail);
router.post('/auth/postDeleteBusinessAccount', authController.postDeleteBusinessAccount);
router.post('/auth/getUsers', authController.getUsers);
router.post('/auth/postDeleteUser', authController.postDeleteUser);
router.post('/auth/postAddUser', authController.postAddUser);
router.post('/auth/resetPassword', authController.resetPassword);

module.exports = router;