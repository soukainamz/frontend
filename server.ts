import { MongoClient, Collection } from 'mongodb';

const uri: string = "mongodb://localhost:27017/";
const client: MongoClient = new MongoClient(uri);

async function runServer(): Promise<void> {
  try {
    console.log("Starting server...");
    await client.connect();
    console.log('Connected to local MongoDB');

    // Select the database and collection
    const database = client.db('frontend');
    const collection: Collection = database.collection('Statistics');

    // Start polling for changes in the collection
    pollForChanges(collection);
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}

/**
 * Polls the collection for changes every second.
 * When a new document is detected (by comparing the document’s _id),
 * it logs the new document.
 * @param collection - The MongoDB collection to poll.
 */
async function pollForChanges(collection: Collection): Promise<void> {
  // Retrieve the most recent document (based on natural order)
  let lastDocument = await collection.findOne({}, { sort: { $natural: -1 } });

  console.log('Polling for changes in the collection...');

  // Poll every 1 second
  setInterval(async () => {
    try {
      // Get the latest document
      const currentDocument = await collection.findOne({}, { sort: { $natural: -1 } });

      // If a new document is detected (by comparing _id)
      if (
        currentDocument &&
        (!lastDocument || String(currentDocument._id) !== String(lastDocument._id))
      ) {
        console.log('Change detected:', currentDocument);
        console.log("New document found:");
    
        lastDocument = currentDocument; // Update the reference to the latest document
      }
    } catch (err) {
      console.error('Error while polling for changes:', err);
    }
  }, 1000);
}

// Run the server
runServer();
