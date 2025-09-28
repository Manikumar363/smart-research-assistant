const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function createPineconeIndex() {
  try {
    console.log('🔧 Initializing Pinecone...');
    
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX_NAME || 'research-assistant';
    
    console.log(`📋 Checking if index '${indexName}' exists...`);
    
    // List existing indexes
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some(index => index.name === indexName);
    
    if (indexExists) {
      console.log(`✅ Index '${indexName}' already exists!`);
      return;
    }
    
    console.log(`🏗️ Creating index '${indexName}'...`);
    
    // Create the index
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536, // text-embedding-ada-002 dimensions
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    console.log(`✅ Successfully created index '${indexName}'!`);
    console.log('⏳ Note: It may take a few minutes for the index to be ready.');
    console.log('🔄 You can check the status at: https://app.pinecone.io/');
    
  } catch (error) {
    console.error('❌ Error creating Pinecone index:', error.message);
    console.error('📋 Available actions:');
    console.error('  1. Check your PINECONE_API_KEY in .env file');
    console.error('  2. Create the index manually at https://app.pinecone.io/');
    console.error('  3. Ensure you have sufficient quota in your Pinecone account');
  }
}

// Run the function
createPineconeIndex();