const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const fs = require("fs");

const getCoorForAddress = require("../util/location");
const HttpError = require("../models/http-error");
const Place = require("../models/place");
const User = require("../models/user");

const getPlaces = async (req, res, next) => {
    let places;

    try {
        places = await Place.find();
    } catch (err) {
        const error = new HttpError(`Could not fetch places`, 500);
        return next(error);
    }

    // if (places.length === 0) {
    //     // We use next(error) that will be forwarded to the error middleware
    //     const error = new HttpError(`No places in Db`, 404);
    //     return next(error);
    // }
    res.json({
        places: places.map((place) => place.toObject({ getters: true })),
    });
};

const getPlaceById = async (req, res, next) => {
    const placeId = req.params.placeId;

    let place;
    try {
        //Don't return a real promise. With .exec() at the end it will return a real promise
        place = await Place.findById(placeId);
    } catch (err) {
        const error = new HttpError(
            `Could not fetch place for the provided id: ${placeId}`,
            500
        );
        return next(error);
    }

    if (!place) {
        const error = new HttpError(
            `Could not find a place for the provided id: ${placeId}`,
            404
        );
        return next(error);
    }

    // We use getters modifier to get the id from Mongo DB without underscore
    // We use toObject method from mongoose to transform to a normal javascript object
    res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUser = async (req, res, next) => {
    const userId = req.params.userId;

    let places;

    try {
        places = await Place.find({ creator: userId });
    } catch (err) {
        const error = new HttpError(
            `Could not fetch places for provided user: ${userId}`,
            500
        );
        return next(error);
    }

    res.json({
        places: places.map((place) => place.toObject({ getters: true })),
    });
};

const createPlace = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const error = new HttpError("Place not correctly formatted", 422);
        return next(error);
    }

    const { title, description, address, creator } = req.body;

    let coordinates;

    try {
        coordinates = await getCoorForAddress(address);
    } catch (error) {
        return next(error);
    }

    const createdPlace = new Place({
        title,
        description,
        address,
        location: coordinates,
        image: req.file.path,
        creator,
    });

    let user;

    try {
        user = await User.findById(creator);
    } catch (err) {
        const error = new HttpError("Creating a new place failed", 500);
        return next(error);
    }

    if (!user) {
        const error = new HttpError(
            `Could not find user with id: ${creator}`,
            404
        );
        return next(error);
    }
    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdPlace.save({ session: sess });
        //push method used by mongoose, not push method from arrays
        user.places.push(createdPlace);
        await user.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError("Creating place failed", 500);
        return next(error);
    }

    res.status(201).json({ place: createdPlace }); //Normal status code when something is succesfully created
};

const updatePlace = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const error = new HttpError("Place not correctly formatted", 422);
        return next(error);
    }

    const { title, description } = req.body;
    const placeId = req.params.placeId;

    let updatedPlace;

    try {
        updatedPlace = await Place.findById(placeId);

        if (!updatedPlace) {
            const error = new HttpError(`No place with id: ${placeId}`, 404);
            return next(error);
        }

        if (updatedPlace.creator.toString() !== req.userData.userId) {
            const error = new HttpError(
                "You are not allowed to edit this place",
                403
            );
            return next(error);
        }

        updatedPlace.title = title;
        updatedPlace.description = description;

        await updatedPlace.save();
    } catch (err) {
        const error = new HttpError(
            `Could not update place with id: ${placeId} `,
            500
        );
        return next(error);
    }

    res.json({ updatedPlace: updatedPlace.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
    const placeId = req.params.placeId;

    let deletedPlace;

    try {
        // with the populate method you get access to content stored in a different collection
        deletedPlace = await Place.findById(placeId).populate("creator");
    } catch (err) {
        const error = new HttpError(
            `Could not delete place with id: ${placeId}`,
            500
        );
        return next(error);
    }

    if (deletedPlace.creator.id !== req.userData.userId) {
        const error = new HttpError(
            "You are not allowed to delete this place",
            403
        );
        return next(error);
    }
    if (!deletedPlace) {
        const error = new HttpError(
            `Could not find place with id: ${placeId}`,
            404
        );
        return next(error);
    }

    const imagePath = deletedPlace.image;

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await Place.deleteOne({ _id: placeId }, { session: sess });
        deletedPlace.creator.places.pull(deletedPlace);
        await deletedPlace.creator.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        const error = new HttpError(
            `Could not delete place with id: ${placeId}`,
            500
        );
        return next(error);
    }

    fs.unlink(imagePath, (err) => {
        console.log(err);
    });

    res.json({ message: `Place with id ${placeId} has been deleted.` });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUser = getPlacesByUser;
exports.createPlace = createPlace;
exports.getPlaces = getPlaces;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
