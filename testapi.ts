const axios = require('axios');

async function fetchAPIData() {
  try {
    console.log("Fetching hourly data for today:");
    const hourlyRes = await axios.get('http://localhost:3000/api/hourly/today');
    console.log(JSON.stringify(hourlyRes.data, null, 2));

    console.log("\nFetching daily data for this week:");
    const dailyRes = await axios.get('http://localhost:3000/api/daily/week');
    console.log(JSON.stringify(dailyRes.data, null, 2));

    console.log("\nFetching weekly data for this month:");
    const weeklyRes = await axios.get('http://localhost:3000/api/weekly/month');
    console.log(JSON.stringify(weeklyRes.data, null, 2));
  } catch (error) {
    console.error("Error fetching API data:", error.message);
  }
}

fetchAPIData();
