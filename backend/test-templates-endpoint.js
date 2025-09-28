/**
 * Test the live sources templates endpoint
 */

const axios = require('axios');

async function testTemplatesEndpoint() {
  console.log('🧪 Testing Live Sources Templates Endpoint\n');

  try {
    const response = await axios.get('http://localhost:5001/api/live-sources/templates', {
      headers: {
        'Authorization': 'Bearer fake-token-for-testing',
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Response Status:', response.status);
    console.log('📋 Templates Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.templates) {
      console.log(`\n📊 Found ${response.data.templates.length} templates:`);
      response.data.templates.forEach((template, index) => {
        console.log(`  ${index + 1}. ${template.name} (${template.type})`);
        console.log(`     URL: ${template.url}`);
        console.log(`     Category: ${template.category}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Failed to fetch templates:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testTemplatesEndpoint();