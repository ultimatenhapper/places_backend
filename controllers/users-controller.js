const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");

const getUsers = async (req, res, next) => {
    let users;

    try {
        users = await User.find({}, "-password");
    } catch (err) {
        const error = new HttpError("Could not fetch users", 404);
        return next(error);
    }

    res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const getUserById = async (req, res, next) => {
    const userId = req.params.userId;

    let user;

    try {
        user = await User.findById(userId);

        if (!user) {
            const error = new HttpError(
                `Could not find user with id: ${userId}`,
                404
            );
            return next(error);
        }
    } catch (err) {
        const error = new HttpError(
            `Could not fetch user with id: ${userId}`,
            500
        );
        return next(error);
    }

    res.json({ user: user.toObject({ getters: true }) });
};

const userSignup = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new HttpError(
            `Invalid inputs passed, check your data`,
            422
        );
        return next(error);
    }

    const { name, email, password } = req.body;

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 12);
    } catch (err) {
        const error = new HttpError(
            "Could not create a user, please try again",
            500
        );
        return next(error);
    }

    const createdUser = new User({
        name,
        email,
        password: hashedPassword,
        image: req.file.path,
        places: [],
    });

    let user;

    try {
        user = await User.findOne({ email: email });

        if (user) {
            const error = new HttpError("Email already in use", 424);
            return next(error);
        }

        await createdUser.save();
    } catch (err) {
        const error = new HttpError("Could not create user", 500);
        return next(error);
    }

    let token;
    try {
        token = jwt.sign(
            { userId: createdUser.id, email: createdUser.email },
            "secret_password",
            { expiresIn: "1h" }
        );
    } catch (err) {
        const error = new HttpError("Sign up failed, please try again", 500);
        return next(error);
    }

    res.status(201).json({
        userId: createdUser.id,
        email: createdUser.email,
        token: token,
    });
};

const userLogin = async (req, res, next) => {
    const { email, password } = req.body;

    let existingUser;

    try {
        existingUser = await User.findOne({ email: email });
    } catch (err) {
        const error = new HttpError(`Login failed, please try again`, 500);
        return next(error);
    }

    if (!existingUser) {
        const error = new HttpError(
            "Invalid credentials, could not log in",
            401
        );
        return next(error);
    }

    let isValidPassword = false;
    try {
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    } catch (err) {
        const error = new HttpError(
            "Could not log in, please check your credentials",
            500
        );
        return next(error);
    }

    if (!isValidPassword) {
        const error = new HttpError(
            "Invalid credetials, could not log in",
            401
        );
        return next(error);
    }

    let token;
    try {
        token = jwt.sign(
            { userId: existingUser.id, email: existingUser.email },
            "secret_password",
            { expiresIn: "1h" }
        );
    } catch (err) {
        // console.log(err);
        const error = new HttpError("Could not log in, please try again", 500);
        return next(error);
    }

    res.json({
        userId: existingUser.id,
        email: existingUser.email,
        token: token
    });
};

exports.getUsers = getUsers;
exports.getUserById = getUserById;
exports.userSignup = userSignup;
exports.userLogin = userLogin;
