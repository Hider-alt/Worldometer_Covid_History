// Store Worldometer Covid data to MongoDB

require('dotenv').config();
const { areDateShifted, areDataDifferent, refactorCountryKeys } = require('./utils.js')

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const PORT = process.env.PORT || 3000;

// Creating express app
const app = express();
app.use(express.json());

// Connecting to MongoDB
mongoose.connect(process.env.DB_URL, {useNewUrlParser: true, useUnifiedTopology: true})

// Creating schema
const covidSchema = new mongoose.Schema({
    country: String,
    countryInfo: {
        "iso2": String,
        "iso3": String,
        "lat": Number,
        "long": Number,
        "flag": String
    },
    history: [{
        _id: false,
        "date": String,
        "cases": Number,
        "dailyCases": Number,
        "deaths": Number,
        "dailyDeaths": Number,
        "recovered": Number,
        "dailyRecovered": Number,
        "active": Number,
        "critical": Number,
        "casesPerOneMillion": Number,
        "deathsPerOneMillion": Number,
        "tests": Number,
        "testsPerOneMillion": Number,
        "population": Number,
        "continent": Number,
        "oneCasePerPeople": Number,
        "oneDeathPerPeople": Number,
        "oneTestPerPeople": Number,
        "activePerOneMillion": Number,
        "recoveredPerOneMillion": Number,
        "criticalPerOneMillion": Number
    }]
});

// Creating model
const Covid = mongoose.model('histories', covidSchema);

// -- Routes --

app.get('/api/countries', async (req, res) => {
    const countries = await Covid.find({}, {_id: 0, country: 1});

    // Transform list of countries to array
    const countriesArray = [];
    for (const country of countries)
        countriesArray.push(country["country"]);

    res.send(countriesArray);
});


app.get('/api/history/all', async (req, res) => {
    const last_days = req.query["lastDays"];

    let projection = {_id: 0, __v: 0, country: 1, history: {$slice: -last_days}};
    if (!last_days)
        projection = {_id: 0, country: 1, history: {$slice: -90}};
    else if (last_days > 90)
        res.status(400).send({"error": "lastDays must be less than 91"});

    const countries = await Covid.find({}, projection);
    res.send(countries);
});


app.get('/api/history/:country', async (req, res) => {
    const last_days = req.query["lastDays"];
    const country = req.params.country;

    let projection = {_id: 0, __v: 0, history: {$slice: -last_days}};
    if (!last_days)
        projection = {_id: 0, history: 1};

    const data = await findCountry(country, projection);

    if (!data) {
        res.status(404).send({"error": `Country ${country} not found`});
        return;
    }

    res.send(data["history"]);
})


app.get('/api/history/:country/:key', async (req, res) => {
    // Returns an array of objects containing date and custom key specified in the request

    const country = req.params.country;
    const key = req.params.key;
    const lastDays = req.query["lastDays"];

    let projection = {_id: 0, history: {$slice: -lastDays}};
    if (!lastDays)
        projection = {_id: 0, history: 1};

    const data = await findCountry(country, projection);

    if (!data) {
        res.status(404).send({"error": `Country ${country} not found`});
        return;
    }

    const customHistory = [];

    for (const day of data["history"]) {
        customHistory.push({
            date: day["date"],
            [key]: day[key]
        });
    }

    res.send(customHistory);
});


app.get('/api/countries/:country/info', async (req, res) => {
    const country = req.params.country;
    const data = await findCountry(country, {_id: 0, __v: 0, history: 0});

    if (!data) {
        res.status(404).send({"error": `Country ${country} not found`});
        return;
    }

    const countryInfo = JSON.parse(JSON.stringify(data.countryInfo));
    countryInfo.country = data.country;

    res.send(countryInfo);
});


async function findCountry(country, projection) {
    country = new RegExp(`^${country.replace(/%20/g, ' ')}$`, 'i');
    let covid = await Covid.findOne({country: country}, projection);

    // Try with ISO2 code
    if (!covid) {
        covid = await Covid.findOne({"countryInfo.iso2": country}, projection);

        // If country is not found, try with ISO3 code
        if (!covid) {
            covid = await Covid.findOne({"countryInfo.iso3": country}, projection);
        }

        // If country is not found, then return 404
        if (!covid) {
            return null;
        }
    }

    return covid;
}


// Pull every 10 minutes from https://disease.sh/v3/covid-19/countries and save to MongoDB
updateCountries();
setInterval(updateCountries, 10 * 60 * 1000);

// Listening to port
app.listen(PORT, () => {
    console.log(`Listening to port ${PORT}`);
});


async function updateCountries() {
    const now = new Date();
    const nowDate = now.toISOString().split('T')[0];

    console.log(`[${now.toISOString()}] Updating countries...`);

    // Today date
    let today = nowDate;

    // Yesterday date
    let yesterday = new Date(new Date().setDate(now.getDate() - 1)).toISOString().split('T')[0];

    // 2 days ago date
    let twoDaysAgo = new Date(new Date().setDate(now.getDate() - 2)).toISOString().split('T')[0];

    // 3 days ago date
    const threeDaysAgo = new Date(new Date().setDate(now.getDate() - 3)).toISOString().split('T')[0];

    if (await areDateShifted()) {
        console.log(`Dates shifted`);
        today = yesterday;
        yesterday = twoDaysAgo;
        twoDaysAgo = threeDaysAgo;
    }

    await updateCountryDay(`&twoDaysAgo=true`, twoDaysAgo);
    await updateCountryDay(`&yesterday=true`, yesterday);
    await updateCountryDay('', today);

    console.log("Update finished");
}


async function updateCountryDay(apiQuery, date) {
    const url = `https://disease.sh/v3/covid-19/countries?allowNull=true${apiQuery}`;
    const countriesRequest = await axios.get(url);
    const countriesDB = await Covid.find({"history.date": date}, {_id: 0, country: 1, "history.$": 1}).exec();

    for (const country of countriesRequest.data) {
        const countryName = country.country;
        refactorCountryKeys(country, date);

        let countryDB = countriesDB.find(c => c.country === countryName);

        // If today data is not in db, then insert it
        if (!countryDB) {
            await Covid.updateOne({country: countryName}, {$push: {history: country}});
            console.log(`[${date}] Inserted ${countryName}`);
            continue;
        }

        countryDB = JSON.parse(JSON.stringify(countryDB))['history'][0];

        // If country day is in db, then check if data are different
        if (areDataDifferent(countryDB, country)) {
            await Covid.updateOne({country: countryName, "history.date": date}, {$set: {"history.$": country}});
            console.log(`[${date}] Updated ${countryName}`);
        }
    }
}
