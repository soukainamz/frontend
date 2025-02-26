import { MongoClient, Collection } from 'mongodb';

const uri: string = "mongodb://localhost:27017/";
const client: MongoClient = new MongoClient(uri);

async function runServer(): Promise<void> {
  try {
    console.log("Starting server...");
    await client.connect();
    console.log("Connected to local MongoDB");

    // Select the database and collections
    const database = client.db('frontend');
    const statsCollection: Collection = database.collection('Statistics');
    const dailyStatsCollection: Collection = database.collection('Day');
    const weeklyStatsCollection: Collection = database.collection('week');
    const monthlyStatsCollection: Collection = database.collection('month');
    const hourlyStatsCollection: Collection = database.collection('hours');

    // Start polling for new transactions
    pollForChanges(
      statsCollection,
      dailyStatsCollection,
      weeklyStatsCollection,
      monthlyStatsCollection,
      hourlyStatsCollection
    );
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}

/**
 * Polls the Statistics collection for new documents every second.
 * When a new transaction is detected, updates the daily, weekly,
 * monthly, and hourly aggregated statistics.
 */
async function pollForChanges(
  statsCollection: Collection,
  dailyStatsCollection: Collection,
  weeklyStatsCollection: Collection,
  monthlyStatsCollection: Collection,
  hourlyStatsCollection: Collection
): Promise<void> {
  // Retrieve the most recent document (using natural order)
  let lastDocument = await statsCollection.findOne({}, { sort: { $natural: -1 } });

  console.log("Polling for changes in the Statistics collection...");

  // Poll every 1 second
  setInterval(async () => {
    try {
      // Get the latest document
      const currentDocument = await statsCollection.findOne({}, { sort: { $natural: -1 } });

      // If a new document is detected (by comparing _id)
      if (
        currentDocument &&
        (!lastDocument || String(currentDocument._id) !== String(lastDocument._id))
      ) {
        console.log("New transaction detected:", currentDocument);

        // Update daily, weekly, monthly, and hourly stats based on this transaction
        await updateDailyStats(currentDocument, dailyStatsCollection);
        await updateWeeklyStats(currentDocument, weeklyStatsCollection);
        await updateMonthlyStats(currentDocument, monthlyStatsCollection);
        await updateHourlyStats(currentDocument, hourlyStatsCollection);

        // Update our reference to the latest document
        lastDocument = currentDocument;
      }
    } catch (err) {
      console.error("Error while polling for changes:", err);
    }
  }, 1000);
}

/**
 * Helper: Extracts the timestamp as a Date from the transaction document.
 */
function getDateFromTransaction(transaction: any): Date {
  if (transaction.timestamp instanceof Date) {
    return transaction.timestamp;
  } else if (transaction.timestamp && transaction.timestamp.$date) {
    return new Date(transaction.timestamp.$date);
  } else {
    return new Date();
  }
}

/**
 * Helper: Returns a date key in the format "YYYY-MM-DD".
 */
function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Helper: Returns a month key in the format "YYYY-MM".
 */
function getMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Helper: Returns an ISO week key in the format "YYYY-Www".
 * (Example: "2025-W09")
 */
function getWeekKey(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  // Adjust to Thursday in current week — ISO weeks consider the week with Thursday as the first week.
  const dayNum = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() + 4 - dayNum);
  const year = d.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const diffInDays = Math.floor((d.getTime() - firstDayOfYear.getTime()) / 86400000);
  const weekNumber = Math.floor(diffInDays / 7) + 1;
  return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
}

/**
 * Helper: Returns an hour key in the format "YYYY-MM-DDTHH".
 * (Example: "2025-02-25T10")
 */
function getHourKey(date: Date): string {
  return date.toISOString().slice(0, 13);
}

/**
 * Updates (or creates) the daily stats document using the transaction data.
 */
async function updateDailyStats(
  transaction: any,
  dailyStatsCollection: Collection
): Promise<void> {
  const date = getDateFromTransaction(transaction);
  const dateKey = getDateKey(date);

  const isSuccess = transaction.transaction === "completed";
  const successCount = isSuccess ? 1 : 0;
  const failCount = isSuccess ? 0 : 1;

  // Calculate fees spent.
  const fee = Number(transaction.fee) || 0;
  const platformFee = Number(transaction.platformFee) || 0;
  const priorityFee = Number(transaction.priorityFee) || 0;
  const feesSpent = fee + platformFee + priorityFee;

  const timeTaken = Number(transaction.timeTaken) || 0;

  let win = 0;
  let loss = 0;
  if (transaction.decision === "profit") {
    win = Number(transaction.amountOut) - Number(transaction.amountIn);
  } else {
    loss = Number(transaction.amountIn) - Number(transaction.amountOut);
    if (loss < 0) loss = 0;
  }
  const profit = win - loss;

  await dailyStatsCollection.updateOne(
    { date: dateKey },
    {
      $inc: {
        successCount,
        failCount,
        totalTransactions: 1,
        totalFeesSpent: feesSpent,
        totalTimeTaken: timeTaken,
        totalWin: win,
        totalLoss: loss,
        netProfit: profit,
      },
      $setOnInsert: { date: dateKey },
    },
    { upsert: true }
  );

  const updatedDoc = await dailyStatsCollection.findOne({ date: dateKey });
  if (updatedDoc && updatedDoc.totalTransactions && updatedDoc.totalTimeTaken !== undefined) {
    const averageTimeTaken = updatedDoc.totalTimeTaken / updatedDoc.totalTransactions;
    await dailyStatsCollection.updateOne({ date: dateKey }, { $set: { averageTimeTaken } });
  }

  console.log(`Daily stats updated for ${dateKey}`);
}

/**
 * Updates (or creates) the weekly stats document using the transaction data.
 */
async function updateWeeklyStats(
  transaction: any,
  weeklyStatsCollection: Collection
): Promise<void> {
  const date = getDateFromTransaction(transaction);
  const weekKey = getWeekKey(date);

  const isSuccess = transaction.transaction === "completed";
  const successCount = isSuccess ? 1 : 0;
  const failCount = isSuccess ? 0 : 1;

  const fee = Number(transaction.fee) || 0;
  const platformFee = Number(transaction.platformFee) || 0;
  const priorityFee = Number(transaction.priorityFee) || 0;
  const feesSpent = fee + platformFee + priorityFee;

  const timeTaken = Number(transaction.timeTaken) || 0;

  let win = 0;
  let loss = 0;
  if (transaction.decision === "profit") {
    win = Number(transaction.amountOut) - Number(transaction.amountIn);
  } else {
    loss = Number(transaction.amountIn) - Number(transaction.amountOut);
    if (loss < 0) loss = 0;
  }
  const profit = win - loss;

  await weeklyStatsCollection.updateOne(
    { week: weekKey },
    {
      $inc: {
        successCount,
        failCount,
        totalTransactions: 1,
        totalFeesSpent: feesSpent,
        totalTimeTaken: timeTaken,
        totalWin: win,
        totalLoss: loss,
        netProfit: profit,
      },
      $setOnInsert: { week: weekKey },
    },
    { upsert: true }
  );

  const updatedDoc = await weeklyStatsCollection.findOne({ week: weekKey });
  if (updatedDoc && updatedDoc.totalTransactions && updatedDoc.totalTimeTaken !== undefined) {
    const averageTimeTaken = updatedDoc.totalTimeTaken / updatedDoc.totalTransactions;
    await weeklyStatsCollection.updateOne({ week: weekKey }, { $set: { averageTimeTaken } });
  }

  console.log(`Weekly stats updated for ${weekKey}`);
}

/**
 * Updates (or creates) the monthly stats document using the transaction data.
 */
async function updateMonthlyStats(
  transaction: any,
  monthlyStatsCollection: Collection
): Promise<void> {
  const date = getDateFromTransaction(transaction);
  const monthKey = getMonthKey(date);

  const isSuccess = transaction.transaction === "completed";
  const successCount = isSuccess ? 1 : 0;
  const failCount = isSuccess ? 0 : 1;

  const fee = Number(transaction.fee) || 0;
  const platformFee = Number(transaction.platformFee) || 0;
  const priorityFee = Number(transaction.priorityFee) || 0;
  const feesSpent = fee + platformFee + priorityFee;

  const timeTaken = Number(transaction.timeTaken) || 0;

  let win = 0;
  let loss = 0;
  if (transaction.decision === "profit") {
    win = Number(transaction.amountOut) - Number(transaction.amountIn);
  } else {
    loss = Number(transaction.amountIn) - Number(transaction.amountOut);
    if (loss < 0) loss = 0;
  }
  const profit = win - loss;

  await monthlyStatsCollection.updateOne(
    { month: monthKey },
    {
      $inc: {
        successCount,
        failCount,
        totalTransactions: 1,
        totalFeesSpent: feesSpent,
        totalTimeTaken: timeTaken,
        totalWin: win,
        totalLoss: loss,
        netProfit: profit,
      },
      $setOnInsert: { month: monthKey },
    },
    { upsert: true }
  );

  const updatedDoc = await monthlyStatsCollection.findOne({ month: monthKey });
  if (updatedDoc && updatedDoc.totalTransactions && updatedDoc.totalTimeTaken !== undefined) {
    const averageTimeTaken = updatedDoc.totalTimeTaken / updatedDoc.totalTransactions;
    await monthlyStatsCollection.updateOne({ month: monthKey }, { $set: { averageTimeTaken } });
  }

  console.log(`Monthly stats updated for ${monthKey}`);
}

/**
 * Updates (or creates) the hourly stats document using the transaction data.
 */
async function updateHourlyStats(
  transaction: any,
  hourlyStatsCollection: Collection
): Promise<void> {
  const date = getDateFromTransaction(transaction);
  const hourKey = getHourKey(date);

  const isSuccess = transaction.transaction === "completed";
  const successCount = isSuccess ? 1 : 0;
  const failCount = isSuccess ? 0 : 1;

  const fee = Number(transaction.fee) || 0;
  const platformFee = Number(transaction.platformFee) || 0;
  const priorityFee = Number(transaction.priorityFee) || 0;
  const feesSpent = fee + platformFee + priorityFee;

  const timeTaken = Number(transaction.timeTaken) || 0;

  let win = 0;
  let loss = 0;
  if (transaction.decision === "profit") {
    win = Number(transaction.amountOut) - Number(transaction.amountIn);
  } else {
    loss = Number(transaction.amountIn) - Number(transaction.amountOut);
    if (loss < 0) loss = 0;
  }
  const profit = win - loss;

  await hourlyStatsCollection.updateOne(
    { hour: hourKey },
    {
      $inc: {
        successCount,
        failCount,
        totalTransactions: 1,
        totalFeesSpent: feesSpent,
        totalTimeTaken: timeTaken,
        totalWin: win,
        totalLoss: loss,
        netProfit: profit,
      },
      $setOnInsert: { hour: hourKey },
    },
    { upsert: true }
  );

  const updatedDoc = await hourlyStatsCollection.findOne({ hour: hourKey });
  if (updatedDoc && updatedDoc.totalTransactions && updatedDoc.totalTimeTaken !== undefined) {
    const averageTimeTaken = updatedDoc.totalTimeTaken / updatedDoc.totalTransactions;
    await hourlyStatsCollection.updateOne({ hour: hourKey }, { $set: { averageTimeTaken } });
  }

  console.log(`Hourly stats updated for ${hourKey}`);
}

// Run the server
runServer();
