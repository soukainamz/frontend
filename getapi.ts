// import express from "express";
// import { MongoClient, Collection } from "mongodb";

// const app = express();
// const port = process.env.PORT || 3000;
// const uri = "mongodb://localhost:27017/";
// const client = new MongoClient(uri);
// const dbName = "frontend";

// async function startServer() {
//   try {
//     await client.connect();
//     console.log("Connected to MongoDB");

//     const db = client.db(dbName);
//     const hourlyStatsCollection: Collection = db.collection("hours");
//     const dailyStatsCollection: Collection = db.collection("Day");
//     const aggregateCollection: Collection = db.collection("Global");

//     /**
//      * GET /api/hourly/today
//      * Returns the hourly data for today.
//      */
//     app.get("/api/hourly/today", async (req, res) => {
//       try {
//         // Get today's date string in "YYYY-MM-DD" format.
//         const todayStr = new Date().toISOString().slice(0, 10);
//         // Find documents where the hour key starts with today's date.
//         const hourlyData = await hourlyStatsCollection
//           .find({ hour: { $regex: `^${todayStr}` } })
//           .toArray();
//         res.json({ success: true, data: hourlyData });
//       } catch (error: any) {
//         res.status(500).json({ success: false, error: error.message });
//       }
//     });

//     /**
//      * GET /api/daily/week
//      * Returns the daily data for the current week (Monday to Sunday).
//      */
//     app.get("/api/daily/week", async (req, res) => {
//       try {
//         const now = new Date();
//         // Determine the current day of week (0 = Sunday, 1 = Monday, …)
//         const day = now.getDay();
//         // Compute Monday of the current week:
//         // If today is Sunday (0), we subtract 6 days; otherwise, subtract (day - 1).
//         const diffToMonday = day === 0 ? 6 : day - 1;
//         const monday = new Date(now);
//         monday.setDate(now.getDate() - diffToMonday);
//         const mondayStr = monday.toISOString().slice(0, 10);

//         // Define next Monday to create an exclusive range.
//         const nextMonday = new Date(monday);
//         nextMonday.setDate(monday.getDate() + 7);
//         const nextMondayStr = nextMonday.toISOString().slice(0, 10);

//         // Query DailyStats for dates between mondayStr (inclusive) and nextMondayStr (exclusive)
//         const dailyData = await dailyStatsCollection
//           .find({ date: { $gte: mondayStr, $lt: nextMondayStr } })
//           .toArray();
//         res.json({ success: true, data: dailyData });
//       } catch (error: any) {
//         res.status(500).json({ success: false, error: error.message });
//       }
//     });

//     /**
//      * GET /api/weekly/month
//      * Returns the weekly data for the current month by aggregating the daily stats.
//      */
//     app.get("/api/weekly/month", async (req, res) => {
//       try {
//         const now = new Date();
//         const year = now.getFullYear();
//         const month = (now.getMonth() + 1).toString().padStart(2, "0");
//         const monthPrefix = `${year}-${month}`; // e.g. "2025-02"

//         const weeklyData = await dailyStatsCollection
//           .aggregate([
//             {
//               $match: {
//                 // Match daily stats whose date (formatted as "YYYY-MM-DD")
//                 // begins with the current month prefix.
//                 date: { $regex: `^${monthPrefix}` },
//               },
//             },
//             {
//               // Convert the date string to a Date object.
//               $addFields: {
//                 dateObj: {
//                   $dateFromString: { dateString: "$date", format: "%Y-%m-%d" },
//                 },
//               },
//             },
//             {
//               // Group by ISO week and ISO week year.
//               $group: {
//                 _id: {
//                   week: { $isoWeek: "$dateObj" },
//                   year: { $isoWeekYear: "$dateObj" },
//                 },
//                 successCount: { $sum: "$successCount" },
//                 failCount: { $sum: "$failCount" },
//                 totalTransactions: { $sum: "$totalTransactions" },
//                 totalFeesSpent: { $sum: "$totalFeesSpent" },
//                 totalTimeTaken: { $sum: "$totalTimeTaken" },
//                 totalWin: { $sum: "$totalWin" },
//                 totalLoss: { $sum: "$totalLoss" },
//                 netProfit: { $sum: "$netProfit" },
//               },
//             },
//             {
//               // Project a more friendly week label.
//               $project: {
//                 week: {
//                   $concat: [
//                     { $toString: "$_id.year" },
//                     "-W",
//                     { $toString: "$_id.week" },
//                   ],
//                 },
//                 successCount: 1,
//                 failCount: 1,
//                 totalTransactions: 1,
//                 totalFeesSpent: 1,
//                 totalTimeTaken: 1,
//                 totalWin: 1,
//                 totalLoss: 1,
//                 netProfit: 1,
//                 _id: 0,
//               },
//             },
//           ])
//           .toArray();

//         res.json({ success: true, data: weeklyData });
//       } catch (error: any) {
//         res.status(500).json({ success: false, error: error.message });
//       }
//     });

//     /**
//      * GET /api/aggregate
//      * Returns the global aggregated stats from the Global collection.
//      */
//     app.get("/api/aggregate", async (req, res) => {
//       try {
//         const aggStats = await aggregateCollection.findOne({ id: "aggregatedStats" });
//         if (!aggStats) {
//           return res.json({ success: true, data: {} });
//         }
//         res.json({ success: true, data: aggStats });
//       } catch (error: any) {
//         res.status(500).json({ success: false, error: error.message });
//       }
//     });

//     app.listen(port, () => {
//       console.log(`Server is running on port ${port}`);
//     });
//   } catch (error) {
//     console.error("Error connecting to MongoDB:", error);
//   }
// }

// startServer();




import express from "express";
import { MongoClient, Collection } from "mongodb";

const app = express();
const port = process.env.PORT || 3000;
const uri = "mongodb://localhost:27017/";
const client = new MongoClient(uri);
const dbName = "frontend";

async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbName);
    const hourlyStatsCollection: Collection = db.collection("hours");
    const dailyStatsCollection: Collection = db.collection("Day");
    const aggregateCollection: Collection = db.collection("Global");

    /**
     * GET /api/hourly/today
     * Returns the hourly data for today.
     */
    app.get("/api/hourly/today", async (req, res) => {
      try {
        // On récupère la date du jour au format "YYYY-MM-DD".
        const todayStr = new Date().toISOString().slice(0, 10);
        const hourlyData = await hourlyStatsCollection
          .find({ hour: { $regex: `^${todayStr}` } })
          .toArray();
        res.json({ success: true, data: hourlyData });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    /**
     * GET /api/daily/week
     * Returns the daily data for the current week (Monday to Sunday).
     */
    app.get("/api/daily/week", async (req, res) => {
      try {
        const now = new Date();
        // Calcul du lundi de la semaine en cours.
        const day = now.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        const mondayStr = monday.toISOString().slice(0, 10);
  
        // Calcul du lundi suivant pour définir une plage exclusive.
        const nextMonday = new Date(monday);
        nextMonday.setDate(monday.getDate() + 7);
        const nextMondayStr = nextMonday.toISOString().slice(0, 10);
  
        // La requête s'appuie sur le fait que le champ date commence toujours par "YYYY-MM-DD".
        const dailyData = await dailyStatsCollection
          .find({ date: { $gte: mondayStr, $lt: nextMondayStr } })
          .toArray();
        res.json({ success: true, data: dailyData });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  
    /**
     * GET /api/weekly/month
     * Returns the weekly aggregated data for the current month.
     * Le regroupement se fait désormais par semaine du mois (ex. "2025-02-w4").
     */
    app.get("/api/weekly/month", async (req, res) => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // de 1 à 12
        const monthStr = month.toString().padStart(2, "0");
        const monthPrefix = `${year}-${monthStr}`;
  
        const weeklyData = await dailyStatsCollection.aggregate([
          {
            // Filtrer les documents du mois en cours
            $match: {
              date: { $regex: `^${monthPrefix}` }
            }
          },
          {
            // Extraire la partie "YYYY-MM-DD" du champ date
            $addFields: {
              dateStr: { $substr: ["$date", 0, 10] }
            }
          },
          {
            // Convertir la chaîne en objet Date
            $addFields: {
              dateObj: { $dateFromString: { dateString: "$dateStr", format: "%Y-%m-%d" } }
            }
          },
          {
            // Grouper par année, mois et semaine du mois
            $group: {
              _id: {
                year: { $year: "$dateObj" },
                month: { $month: "$dateObj" },
                weekOfMonth: { $ceil: { $divide: [{ $dayOfMonth: "$dateObj" }, 7] } }
              },
              successCount: { $sum: "$successCount" },
              failCount: { $sum: "$failCount" },
              totalTransactions: { $sum: "$totalTransactions" },
              totalFeesSpent: { $sum: "$totalFeesSpent" },
              totalTimeTaken: { $sum: "$totalTimeTaken" },
              totalWin: { $sum: "$totalWin" },
              totalLoss: { $sum: "$totalLoss" },
              netProfit: { $sum: "$netProfit" },
              averageTimeTaken: { $avg: "$averageTimeTaken" }
            }
          },
          {
            // Construire le label de semaine au format "YYYY-MM-w<weekOfMonth>"
            $project: {
              week: {
                $concat: [
                  { $toString: "$_id.year" },
                  "-",
                  {
                    $cond: [
                      { $lt: ["$_id.month", 10] },
                      { $concat: ["0", { $toString: "$_id.month" }] },
                      { $toString: "$_id.month" }
                    ]
                  },
                  "-w",
                  { $toString: "$_id.weekOfMonth" }
                ]
              },
              successCount: 1,
              failCount: 1,
              totalTransactions: 1,
              totalFeesSpent: 1,
              totalTimeTaken: 1,
              totalWin: 1,
              totalLoss: 1,
              netProfit: 1,
              averageTimeTaken: 1,
              _id: 0
            }
          }
        ]).toArray();
  
        res.json({ success: true, data: weeklyData });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  
    /**
     * GET /api/aggregate
     * Returns the global aggregated stats from the Global collection.
     */
    app.get("/api/aggregate", async (req, res) => {
      try {
        const aggStats = await aggregateCollection.findOne({ id: "aggregatedStats" });
        if (!aggStats) {
          return res.json({ success: true, data: {} });
        }
        res.json({ success: true, data: aggStats });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}
  
startServer();
