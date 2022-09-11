// -- Ran first time to add countries to MongoDB --

// Insert country yesterday data to MongoDB
async function insertCountries() {
    // Request yesterday disease.sh data
    const yesterdayData = await axios.get('https://disease.sh/v3/covid-19/countries?allowNull=true&twoDaysAgo=true');
    const yesterdayDataCountries = yesterdayData.data;

    for (const country of yesterdayDataCountries) {
        const countryName = country.country;
        const countryInfo = country.countryInfo;
        countryInfo['continent'] = country.continent;

        // Get UTC 2 days ago date in YYYY-MM-DD format
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 2);

        delete countryInfo['_id'];
        refactorCountryKeys(country, yesterday.toISOString().split('T')[0]);

        const covid = new Covid({
            country: countryName,
            countryInfo: countryInfo,
            history: [country]
        });

        await covid.save();
        console.log(`Inserted ${countryName} to MongoDB`);
    }
}