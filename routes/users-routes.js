const express = require("express");
const { check } = require("express-validator");

const usersController = require("../controllers/users-controller");
const fileUpload = require('../middleware/file-upload');
const router = express.Router();

router.get("/", usersController.getUsers);
router.get("/:userId", usersController.getUserById);

router.post(
    "/signup",
    fileUpload.single('image'),
    [
        check("name").not().isEmpty(),
        check("email").normalizeEmail().isEmail(),
        check("password").isLength({ min: 6 }),
    ],
    usersController.userSignup
);
router.post("/login", usersController.userLogin);

module.exports = router;
