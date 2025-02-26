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
    const aggregateCollection: Collection = database.collection('Global');
    const dailyStatsCollection: Collection = database.collection('Day');
    const weeklyStatsCollection: Collection = database.collection('week');
    const monthlyStatsCollection: Collection = database.collection('month');
    const hourlyStatsCollection: Collection = database.collection('hours');

    // Start polling for new transactions
    pollForChanges(
      statsCollection,
      aggregateCollection,
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
 * Polls the Statistics collection every second.
 * When a new transaction is detected, updates global and time-based stats.
 */
async function pollForChanges(
  statsCollection: Collection,
  aggregateCollection: Collection,
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
      const currentDocument = await statsCollection.findOne({}, { sort: { $natural: -1 } });
      if (
        currentDocument &&
        (!lastDocument || String(currentDocument._id) !== String(lastDocument._id))
      ) {
        console.log("New transaction detected:", currentDocument);

        // Update global aggregated stats
        await updateAggregateStats(currentDocument, aggregateCollection);

        // Update daily, weekly, monthly, and hourly stats
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
 * Updates (or creates) the global aggregate stats document with the new transaction data.
 * For a profit, it increments totalWin; for a loss, totalLoss and counts specific motifs.
 */
async function updateAggregateStats(
  transaction: any,
  aggregateCollection: Collection
): Promise<void> {
  let win = 0;
  let loss = 0;
  let countLiquidity = 0;
  let countNoBalance = 0;
  let countSlippage = 0;

  if (transaction.decision === "profit") {
    win = Number(transaction.amountOut) - Number(transaction.amountIn);
  } else if (transaction.decision === "loss") {
    loss = Number(transaction.amountIn) - Number(transaction.amountOut);
    const motif = (transaction.motif || "").toLowerCase();
    if (motif.includes("liquidity")) {
      countLiquidity = 1;
    }
    if (motif.includes("no balance")) {
      countNoBalance = 1;
    }
    if (motif.includes("slippage")) {
      countSlippage = 1;
    }
  }

  await aggregateCollection.updateOne(
    { id: "aggregatedStats" },
    {
      $inc: {
        totalWin: win,
        totalLoss: loss,
        countLiquidity: countLiquidity,
        countNoBalance: countNoBalance,
        countSlippage: countSlippage,
      },
    },
    { upsert: true }
  );

  console.log("Aggregate stats updated.");
}

/* -------------------- Helper Functions -------------------- */

/**
 * Extracts a Date from the transaction document.
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
 * Returns a daily key in the format "YYYY-MM-DD-Weekday".
 * For example: "2025-02-25-Tuesday"
 */
function getDateKey(date: Date): string {
  const base = date.toISOString().slice(0, 10);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[date.getDay()];
  return `${base}-${dayName}`;
}

/**
 * Returns a month key in the format "YYYY-MM".
 */
function getMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Returns a weekly key in the format "YYYY-MM-wN", where N is 1-4.
 * Days 1-7 are week 1, 8-14 are week 2, 15-21 are week 3, and days 22+ are week 4.
 */
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  let week = Math.ceil(date.getDate() / 7);
  if (week > 4) {
    week = 4;
  }
  return `${year}-${month}-w${week}`;
}

/**
 * Returns an hour key in the format "YYYY-MM-DDTHH".
 * (Example: "2025-02-25T10")
 */
function getHourKey(date: Date): string {
  return date.toISOString().slice(0, 13);
}

/* -------------------- Time-Based Stats Update Functions -------------------- */

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
