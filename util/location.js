const axios = require("axios");
const HttpError = require("../models/http-error");
const path = require("path");
const dotenv = require("dotenv")

async function getCoordsForAddress(address) {
    const result = dotenv.config({ path: __dirname + "/../.env" });
    // console.log(result.parsed);

    if (result.error) {
        const error = new HttpError(result.error.message, 500);
        throw error;
    }
    
    const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address
        )}&key=${process.env.API_KEY}`
    );
    const data = response.data;

    //The api will return ZERO_RESULTS if not coordinates were found for the address
    if (!data || data.status === "ZERO_RESULTS") {
        const error = new HttpError(
            "Could not find location for specified address.",
            404
        );
        throw error;
    }

    const coordinates = data.results[0].geometry.location;

    return coordinates;
}

module.exports = getCoordsForAddress;
