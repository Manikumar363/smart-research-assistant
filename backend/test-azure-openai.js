const { OpenAI } = require('openai');
require('dotenv').config();

async function testAzureOpenAI() {
  try {
    console.log('🔍 Testing Azure OpenAI Configuration...');
    console.log('Environment Variables:');
    console.log('  AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('  AZURE_OPENAI_BASE_URL:', process.env.AZURE_OPENAI_BASE_URL || '❌ Missing');
    console.log('  AZURE_OPENAI_API_VERSION:', process.env.AZURE_OPENAI_API_VERSION || '❌ Missing');
    console.log('  AZURE_OPENAI_DEPLOYMENT_NAME:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '❌ Missing');

    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_BASE_URL) {
      throw new Error('Missing required Azure OpenAI environment variables');
    }

    const openai = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: process.env.AZURE_OPENAI_BASE_URL,
      defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
      defaultHeaders: {
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
    });

    const chatModel = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
    console.log(`\n🤖 Testing chat completion with model: ${chatModel}`);

    const response = await openai.chat.completions.create({
      model: chatModel,
      messages: [
        { role: 'user', content: 'Hello, this is a test message. Please respond with "Test successful!"' }
      ],
      max_tokens: 50
    });

    console.log('✅ Success! Response:', response.choices[0].message.content);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Error details:', {
      status: error.status,
      code: error.code,
      type: error.type
    });

    if (error.status === 404) {
      console.error('\n💡 404 Error Solutions:');
      console.error('1. Check your deployment name matches exactly what you created in Azure portal');
      console.error('2. Ensure base URL ends with /openai/ (e.g., https://your-resource.openai.azure.com/openai/)');
      console.error('3. Verify API version is correct (try "2024-02-15-preview" or "2023-12-01-preview")');
      console.error('4. Make sure the deployment is fully deployed and available');
    }
  }
}

testAzureOpenAI();