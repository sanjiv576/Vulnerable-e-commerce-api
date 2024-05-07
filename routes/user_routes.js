
const express = require('express');

const router = express.Router();
const userController = require('../controllers/user_controller');
const { verifyUser } = require('../middlewares/auth');


// for creating an account
router.route('/register')
    .get((req, res, next) => res.status(405).json({ error: "GET method is not allowed" }))
    .delete((req, res, next) => res.status(405).json({ error: "DELETE method is not allowed" }))
    .put((req, res, next) => res.status(405).json({ error: "PUT method is not allowed" }))
    .post(userController.userRegister);



// for logging an account
router.route('/login')
    .get((req, res, next) => res.status(405).json({ error: "GET method is not allowed" }))
    .delete((req, res, next) => res.status(405).json({ error: "DELETE method is not allowed" }))
    .put((req, res, next) => res.status(405).json({ error: "PUT method is not allowed" }))
    .post(userController.userLogin);

// for locking an account
router.route('/lockAccount')
    .get((req, res, next) => res.status(405).json({ error: "GET method is not allowed" }))
    .delete((req, res, next) => res.status(405).json({ error: "DELETE method is not allowed" }))
    .put((req, res, next) => res.status(405).json({ error: "PUT method is not allowed" }))
    .post(userController.userAccountLock);

// get,update and delete profile/account
router.route('/')
    .post((req, res, next) => res.status(405).json({ error: "POST method is not allowed" }))
    .get(verifyUser, userController.getProfile)
    .delete(verifyUser, userController.deleteAccount)
    .put(verifyUser, userController.updateProfile);


router.get('/passwordNeedChange', verifyUser, userController.getPasswordExpiry);
router.put('/changePassword', verifyUser, userController.changePassword);

module.exports = router;

