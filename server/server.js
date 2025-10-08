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

// --- FINAL, ADVANCED "QUERY EXPANSION" CHAT ENDPOINT ---
app.post('/api/chat-stream', async (req, res) => {
    const { message, chatType, history } = req.body;

    res.setHeader('Content-Type', 'text-event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    try {
        console.log(`\n--- RAG Request (Category: ${chatType}): "${message}" ---`);
        
        // --- STEP 1: QUERY EXPANSION ---
        // Ask a fast LLM to generate multiple, related search queries.
        console.log("Step 1a: Generating expanded search queries...");
        const expansionMessages = [
            { role: 'system', content: 'You are a helpful search assistant. Based on the user\'s question and conversation history, generate a short list of 3-4 diverse, related search queries that would help find the answer in a database of official protocols. The queries should be in Hebrew. Respond ONLY with the queries, separated by newlines.'},
            { role: 'user', content: `Conversation History:\n${(history || []).map(h => `${h.sender}: ${h.text}`).join('\n')}\n\nOriginal Question: "${message}"` }
        ];
        const expansionResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo', 
            messages: expansionMessages, 
            max_tokens: 200, 
            temperature: 0.3
        });
        const expandedQueries = expansionResponse.choices[0].message.content;
        
        // Combine the original question with the new ones for a powerful search input
        const searchInput = `${message}\n${expandedQueries}`;
        console.log(`Step 1b: Expanded search input for embedding: "${searchInput.replace(/\n/g, ' | ')}"`);

        // --- STEP 2: EMBED THE EXPANDED QUERY ---
        console.log("Step 2: Creating embedding for the expanded query...");
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small", 
            input: searchInput,
        });
        const questionVector = embeddingResponse.data[0].embedding;

        // --- STEP 3: QUERY PINECONE ---
        console.log("Step 3: Querying Pinecone with the expanded vector...");
        const queryResponse = await pineconeIndex.query({
            topK: 7, // Get a healthy number of results
            vector: questionVector,
            filter: { "categoryId": { "$eq": chatType } },
			includeValues: true, 
            includeMetadata: true,
        });
        
        // --- STEP 4: CONSTRUCT CONTEXT (No threshold) ---
        // We will pass more context and trust the powerful final LLM to be the "reranker"
        const context = queryResponse.matches
			.map(match => match.metadata?.text)
            .filter(text => text)
			.join("\n\n---\n\n");
        
		console.log(`Step 4: Constructed context from ${queryResponse.matches.length} matches.`);

        // --- STEP 5: GENERATE FINAL ANSWER ---
        const systemPrompt = "You are an AI assistant named Proto-Kal. Your task is to answer the user's question with extreme precision, based ONLY on the provided Context from official documents. The Conversation History is provided for context about follow-up questions. If the answer is not present in the Context, you MUST respond with the Hebrew phrase 'לא מצאתי תשובה לכך במסמכים שסופקו.' and nothing else.";
        
        const historyForPrompt = (history || []).map(h => ({ role: h.sender === 'user' ? 'user' : 'assistant', content: h.text }));

        const finalMessages = [
            { role: 'system', content: systemPrompt },
            ...historyForPrompt,
            { role: 'user', content: `Here is the relevant context from the documents:\n\n--- CONTEXT START ---\n${context}\n--- CONTEXT END ---\n\nBased on the context above, please answer this question: "${message}"` }
        ];

        console.log("Step 5: Streaming the final answer from OpenAI...");
        const stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: finalMessages,
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