const axios = require("axios");

module.exports = { areDateShifted, areDataDifferent, refactorCountryKeys, addDailyTests };


/**
 * If Italy daily cases are not null before 12 UTC, it means that all countries data are referring to yesterday
 * (because Italy updates data about at 16 local time)
 *
 * @returns {Promise<boolean>}
 */
async function areDateShifted() {
    const italyData = await axios.get('https://disease.sh/v3/covid-19/countries/Italy?allowNull=true');

    const now = new Date();

    // Also check that now is after 00:10 UTC, because data refreshes every 10 minutes, so there could be a delay
    return italyData.data["todayCases"] !== null && now.getUTCHours() < 12 && ((now.getUTCHours() >= 0 && now.getUTCMinutes() > 10) || now.getUTCHours() > 0);
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


/**
 * Add daily tests to country data
 * @param countryData {JSON} - Country data from request
 * @param yesterdayData {JSON} - Country data from DB of yesterday
 */
function addDailyTests(countryData, yesterdayData) {
    const dailyTests = countryData["tests"] - yesterdayData["tests"];

    // Happens when country doesn't report daily tests
    if ((countryData['dailyCases'] > 0 || countryData['dailyCases'] === null) && dailyTests === 0) {
        countryData['dailyTests'] = null;
        return;
    }

    countryData['dailyTests'] = dailyTests;
}