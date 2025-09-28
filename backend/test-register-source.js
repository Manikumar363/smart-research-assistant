const axios = require('axios');

// Test the register-source endpoint
async function testRegisterSource() {
  try {
    console.log('Testing register-source endpoint...');
    
    const testSource = {
      sourceName: 'Test BBC News',
      sourceType: 'rss',
      sourceUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
      maxEntries: 500,
      ingestionInterval: 300,
      config: {}
    };

    const response = await axios.post('http://localhost:5001/api/pathway/register-source', testSource, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // This will fail but let's see the error
      }
    });

    console.log('✅ Success:', response.data);
  } catch (error) {
    console.log('❌ Error details:');
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
    console.log('Message:', error.message);
  }
}

testRegisterSource();