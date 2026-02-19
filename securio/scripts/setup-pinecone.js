require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function setup() {
    console.log('API Key present:', !!process.env.PINECONE_API_KEY);
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

    const indexes = await pc.listIndexes();
    console.log('Existing indexes:', JSON.stringify(indexes, null, 2));

    const indexNames = indexes.indexes?.map(i => i.name) || [];
    if (indexNames.includes('securiox')) {
        console.log('Index securiox already exists!');
        const desc = await pc.describeIndex('securiox');
        console.log('Index details:', JSON.stringify(desc, null, 2));
        return;
    }

    console.log('Creating index securiox (3072 dims, cosine, serverless)...');
    await pc.createIndex({
        name: 'securiox',
        dimension: 3072,
        metric: 'cosine',
        spec: {
            serverless: {
                cloud: 'aws',
                region: 'us-east-1',
            },
        },
    });
    console.log('Index securiox created successfully!');
}

setup().catch(e => console.error('Error:', e.message));
