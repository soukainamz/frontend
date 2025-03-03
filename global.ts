// import { MongoClient, Collection } from 'mongodb';
// import { scrape } from './scrap';

// const uri: string = "mongodb://localhost:27017/";
// const client: MongoClient = new MongoClient(uri);

// async function runServer(): Promise<void> {
//   try {
//     console.log("Starting server...");
//     await client.connect();
//     console.log("Connected to local MongoDB");

//     // Select the database and collections
//     const database = client.db('frontend');
//     const statsCollection: Collection = database.collection('Statistics');
//     const aggregateCollection: Collection = database.collection('Global');

//     // Start listening for new transactions
//     pollForChanges(statsCollection, aggregateCollection);



//   } catch (err) {
//     console.error("Error connecting to MongoDB:", err);
//   }
// }

// /**
//  * Polls the Statistics collection for new documents every second.
//  * When a new transaction is detected, updates the aggregate stats.
//  */
// async function pollForChanges(
//   statsCollection: Collection,
//   aggregateCollection: Collection
// ): Promise<void> {
//   // Retrieve the most recent document (based on natural order)
//   let lastDocument = await statsCollection.findOne({}, { sort: { $natural: -1 } });
//   console.log("Polling for changes in the Statistics collection...");

//   // Poll every 1 second
//   setInterval(async () => {
//     try {
//       const currentDocument = await statsCollection.findOne({}, { sort: { $natural: -1 } });
//       if (
//         currentDocument &&
//         (!lastDocument || String(currentDocument._id) !== String(lastDocument._id))
//       ) {
//         console.log("New transaction detected:", currentDocument);


//         let motifinfo: any = 0;
//         while (motifinfo != 0){
//           motifinfo = await scrape();
//           console.log(motifinfo);
//           // i++;
//         }

//         await updateAggregateStats(currentDocument, aggregateCollection);

//         let i=0;
       
         
//         lastDocument = currentDocument;
//       }
//     } catch (err) {
//       console.error("Error while polling for changes:", err);
//     }
//   }, 5000);
// }

// /**
//  * Updates (or creates) the aggregate stats document with the new transaction data.
//  *
//  * For a profit transaction, it increments totalWin (amountOut - amountIn).  
//  * For a loss transaction, it increments totalLoss (amountIn - amountOut) and,
//  * based on the `motif` field, increments one or more of the following counts:
//  *   - countLiquidity (if motif contains "liquidity")
//  *   - countNoBalance (if motif contains "no balance")
//  *   - countSlippage (if motif contains "slippage")
//  *
//  * The update uses the fixed _id "aggregatedStats" so that all changes
//  * are stored in a single document.
//  */
// async function updateAggregateStats(
//   transaction: any,
//   aggregateCollection: Collection
// ): Promise<void> {
//   let win = 0;
//   let loss = 0;
//   let countLiquidity = 0;
//   let countNoBalance = 0;
//   let countSlippage = 0;

//   // Compute win/loss based on the decision field
//   if (transaction.decision === "profit") {
//     win = Number(transaction.amountOut) - Number(transaction.amountIn);
//   } else if (transaction.decision === "loss") {
//     loss = Number(transaction.amountIn) - Number(transaction.amountOut);
//     const motif = (transaction.motif || "").toLowerCase();
//     if (motif.includes("liquidity")) {
//       countLiquidity = 1;
//     }
//     if (motif.includes("no balance")) {
//       countNoBalance = 1;
//     }
//     if (motif.includes("slippage")) {
//       countSlippage = 1;
//     }
//   }

//   // Update (or insert) the aggregated document with a fixed _id.
//   await aggregateCollection.updateOne(
//     { id: "aggregatedStats" },
//     {
//       $inc: {
//         totalWin: win,
//         totalLoss: loss,
//         countLiquidity: countLiquidity,
//         countNoBalance: countNoBalance,
//         countSlippage: countSlippage,
//       },
//     },
//     { upsert: true }
//   );

//   console.log("Aggregate stats updated.");
// }

// // Run the server
// runServer();






import { MongoClient, Collection } from 'mongodb';
import { scrape } from './scrap';

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

    // Start listening for new transactions
    pollForChanges(statsCollection, aggregateCollection);



  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}

/**
 * Polls the Statistics collection for new documents every second.
 * When a new transaction is detected, updates the aggregate stats.
 */
async function pollForChanges(
  statsCollection: Collection,
  aggregateCollection: Collection
): Promise<void> {
  // Retrieve the most recent document (based on natural order)
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
        // console.log("New transaction detected:", currentDocument);


        let motifinfo: any = 0;
        // while (motifinfo != 0){
          motifinfo = await scrape(currentDocument.txid);
          console.log(motifinfo);
          // i++;
        // }

        // await updateAggregateStats(currentDocument, aggregateCollection);

        // let i=0;
       
         
        lastDocument = currentDocument;
      }
    } catch (err) {
      console.error("Error while polling for changes:", err);
    }
  }, 50000);
}

/**
 * Updates (or creates) the aggregate stats document with the new transaction data.
 *
 * For a profit transaction, it increments totalWin (amountOut - amountIn).  
 * For a loss transaction, it increments totalLoss (amountIn - amountOut) and,
 * based on the `motif` field, increments one or more of the following counts:
 *   - countLiquidity (if motif contains "liquidity")
 *   - countNoBalance (if motif contains "no balance")
 *   - countSlippage (if motif contains "slippage")
 *
 * The update uses the fixed _id "aggregatedStats" so that all changes
 * are stored in a single document.
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

  // Compute win/loss based on the decision field
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

  // Update (or insert) the aggregated document with a fixed _id.
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

// Run the server
runServer();












