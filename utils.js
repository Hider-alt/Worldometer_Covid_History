const axios = require("axios");

module.exports = { areDateShifted, areDataDifferent, refactorCountryKeys };


/**
 * If Italy daily cases are not null before 17 UTC, it means that all countries data are referring to yesterday
 * (because Italy updates data about at 17 local time)
 *
 * @returns {Promise<boolean>}
 */
async function areDateShifted() {
    const italyData = await axios.get('https://disease.sh/v3/covid-19/countries/Italy?allowNull=true');

    // Check that now is between 00:11 UTC and 17:00 UTC
    // 00:11 UTC because Worldometers updates data at 00:00 UTC, but APIs refreshes data every 10 minutes
    const now = new Date();

    return italyData.data.todayCases !== null && now.getUTCHours() < 17;
}


/**
 * Check if DB date are different from the one in the request
 * @param dbData {JSON} - Data from DB
 * @param newData {JSON} - Data from request
 * @returns {boolean} - True if data are different
 */
function areDataDifferent(dbData, newData) {
    const newDataKeys = Object.keys(newData);
    const dbDataKeys = Object.keys(dbData);

    if (newDataKeys.length !== dbDataKeys.length) {
        return true;
    }

    for (let i = 0; i < newDataKeys.length; i++) {
        const key = newDataKeys[i];

        // If key is not in dbData, then return true
        if (dbDataKeys.indexOf(key) === -1) {
            return true;
        }

        // If value is not equal, then return true
        if (dbData[key] !== newData[key]) {
            return true;
        }
    }

    return false;
}


/**
 * Refactor country keys to match the ones in the DB
 * @param countryData {JSON} - Country data from request
 * @param date {string} - Date in YYYY-MM-DD format of the data
 */
function refactorCountryKeys(countryData, date) {
    delete countryData["updated"];
    delete countryData["country"];
    delete countryData["countryInfo"];
    delete countryData["continent"];
    countryData["date"] = date;

    // Rename todayCases to newCases
    countryData["dailyCases"] = countryData["todayCases"];
    delete countryData["todayCases"];

    // Rename todayDeaths to newDeaths
    countryData["dailyDeaths"] = countryData["todayDeaths"];
    delete countryData["todayDeaths"];

    // Rename todayRecovered to newRecovered
    countryData["dailyRecovered"] = countryData["todayRecovered"];
    delete countryData["todayRecovered"];
}
