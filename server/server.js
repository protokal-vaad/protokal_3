// server/server.js (INTEGRATED RAG LOGIC)

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

// NEW: Import Pinecone
const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');

const app = express();
const port = process.env.PORT || 3001;

// --- CORS and Middleware (Your existing code) ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));


// --- API Key and Client Initialization ---
if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY) {
    console.error("\n!!! CRITICAL ERROR: Missing OPENAI_API_KEY or PINECONE_API_KEY in .env file. !!!");
    process.exit(1);
}

// Initialize clients with keys from your .env file
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY, });
const pineconeIndex = pinecone.Index("protokal-ai"); // Use your index name


// --- THIS IS THE MODIFIED CHAT ENDPOINT ---
app.post('/api/chat-stream', async (req, res) => {
    const { message, chatType, history } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    try {
        console.log(`\n--- RAG Request (Category: ${chatType}): "${message}" ---`);
        
        // FIX #1: Correctly build the conversation for search without duplicating the last message.
        const conversationForSearch = history.map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');
        const searchQuery = `${conversationForSearch}\nUser: ${message}`;
        console.log(`Step 1: Using combined search query: "${searchQuery.substring(0, 150)}..."`);
        
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: searchQuery,
        });
        const questionVector = embeddingResponse.data[0].embedding;

        console.log("Step 2: Querying Pinecone for relevant context...");
        
        // --- FIX #2: THIS IS THE CRITICAL MISSING 'await' ---
        const queryResponse = await pineconeIndex.query({
            topK: 10,
            vector: questionVector,
            filter: { "categoryId": { "$eq": chatType } },
			includeValues: true,
            includeMetadata: true,
        });
        // --- END OF FIX ---
		
        const RELEVANCE_THRESHOLD = 0.35;
        const context = queryResponse.matches
			.filter(match => match.score >= RELEVANCE_THRESHOLD)
			.map(match => match.metadata.text)
			.join("\n\n---\n\n");
        
		console.log(`Step 3: Constructed context from ${queryResponse.matches.filter(m => m.score >= RELEVANCE_THRESHOLD).length} valid matches.`);

        const systemPrompt = "You are Proto-Kal, an expert AI assistant... (your prompt)"; // Keep your full prompt
        
        const historyForPrompt = history.map(h => ({
            role: h.sender === 'user' ? 'user' : 'assistant',
            content: h.text
        }));

        const messages = [
            { role: 'system', content: systemPrompt },
            ...historyForPrompt,
            { role: 'user', content: `Context:\n${context}\n\nQuestion: ${message}` }
        ];
        
        console.log("Step 4: Streaming the final answer from OpenAI...");
        const stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }
        
    } catch (error) {
        console.error("\n!!! Error in RAG pipeline !!!", error);
        const errorData = JSON.stringify({ error: 'Failed to get response', details: error.message });
        res.write(`data: ${errorData}\n\n`);
    } finally {
        res.write(`data: [DONE]\n\n`);
        res.end();
        console.log("--- Stream finished ---");
    }
});

// --- Static file serving (Your existing code) ---
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.listen(port, () => {
    console.log(`שרת מאזין ב-http://localhost:${port}`);
});