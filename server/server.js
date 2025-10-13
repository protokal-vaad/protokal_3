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

// --- FINAL, UNIFIED, "INTENT-BASED" CHAT ENDPOINT ---
app.post('/api/chat-stream', async (req, res) => {
    const { message, chatType, history } = req.body;

    res.setHeader('Content-Type', 'text-event-stream');
    // ... (other headers are correct)

    try {
        console.log(`\n--- Unified Request (Category: ${chatType}): "${message}" ---`);

        // --- STEP 1: INTENT CLASSIFICATION ---
        console.log("Step 1: Classifying user intent...");
        const intentMessages = [
            { role: 'system', content: "You are an expert request router. Classify the user's latest query into one of two categories: 'Specific_QA' for questions seeking a specific fact, name, date, or detail (like 'who?', 'what was?', 'when did?'), or 'Broad_Analysis' for questions asking for summaries, main topics, or general themes (like 'summarize', 'what are the main topics?'). Respond with ONLY the category name." },
            { role: 'user', content: `Conversation History:\n${(history || []).map(h => `${h.sender}: ${h.text}`).join('\n')}\n\nLatest Question: "${message}"` }
        ];
        const intentResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: intentMessages,
            max_tokens: 10,
            temperature: 0,
        });
        const intent = intentResponse.choices[0].message.content.trim();
        console.log(`Step 1b: Intent classified as: ${intent}`);
        // --- END OF STEP 1 ---

        let stream;

        if (intent.includes('Specific_QA')) {
            // --- PATH A: RAG for Specific Questions (Simple & Robust) ---
            console.log("--> Executing Specific Q&A Path <--");
            
            // 1. Embed the user's direct question and history
            const historyString = (history || []).map(h => h.text).join('\n');
            const searchInput = `${historyString}\n${message}`.trim();
            console.log(`Step 2a: Creating embedding for search query: "${searchInput}"`);
            const embeddingResponse = await openai.embeddings.create({ model: "text-embedding-3-small", input: searchInput });
            const questionVector = embeddingResponse.data[0].embedding;

            // 2. Query Pinecone
            console.log("Step 2b: Querying Pinecone...");
            const queryResponse = await pineconeIndex.query({
                topK: 10, 
				vector: questionVector, 
				filter: { "categoryId": { "$eq": chatType } },
                includeValues: true, 
				includeMetadata: true,
            });
            
            // 3. Construct Context with a threshold
            const RELEVANCE_THRESHOLD = 0.30; // A reasonable threshold
            const context = queryResponse.matches
                .filter(match => match.score >= RELEVANCE_THRESHOLD)
                .map(match => match.metadata?.text)
                .filter(text => text)
                .join("\n\n---\n\n");
            console.log(`Step 2c: Constructed context from ${queryResponse.matches.filter(m => m.score >= RELEVANCE_THRESHOLD).length} valid matches.`);
			if (!context.trim()) {
				console.log("No sufficient context found, responding directly.");
				res.write(`data: ${JSON.stringify({ content: "לא מצאתי תשובה לכך במסמכים שסופקו." })}\n\n`);
				res.write(`data: [DONE]\n\n`);
				res.end();
				return;
            
            // 4. Build Final Prompt and get stream
            const systemPrompt = "You are an AI assistant, Proto-Kal. Answer the user's question with precision, based ONLY on the provided Context. Always respond in Hebrew. If the answer is not in the Context, state 'לא מצאתי תשובה לכך במסמכים שסופקו.'";
            const historyForPrompt = (history || []).map(h => ({ role: h.sender === 'user' ? 'user' : 'assistant', content: h.text }));
            const finalMessages = [
                { role: 'system', content: systemPrompt },
                ...historyForPrompt,
                { role: 'user', content: `להלן הקשר רלוונטי שבו יש את התשובה לשאלתי. אנא השב במדויק על השאלה שלי בהתבסס אך ורק על המידע בקשר זה. אם התשובה אינה מופיעה כאן, ציין זאת. \n\nהקשר:\n${context}\n\nשאלה: ${message}` }
            ];
            stream = await openai.chat.completions.create({ model: 'gpt-4o', messages: finalMessages, stream: true });

        } else { // Default to Broad_Analysis
            // --- PATH B: RAG for Analysis Questions ---
            console.log("--> Executing Broad Analysis Path <--");

            // 1. Fetch a broad sample from Pinecone
            const dummyVector = new Array(1536).fill(0);
            const queryResponse = await pineconeIndex.query({
                topK: 50, vector: dummyVector, filter: { "categoryId": { "$eq": chatType } },
                includeMetadata: true,
            });
            if (!queryResponse.matches || queryResponse.matches.length === 0) {
                throw new Error("No documents found for this category to analyze.");
            }
            const context = queryResponse.matches.map(match => match.metadata?.text).filter(text => text).join("\n\n---\n\n");
            
            // 2. Build Analyst Prompt and get stream
            const systemPrompt = "You are a professional data analyst. Based ONLY on the provided documents, answer the user's question. The user is asking for a summary, a list of main topics, or a conceptual analysis. Respond in Hebrew.";
            const finalMessages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Documents:\n${context}\n\nBased on the documents above, please answer my question: "${message}"` }
            ];
            stream = await openai.chat.completions.create({ model: 'gpt-4o', messages: finalMessages, stream: true });
        }

        // --- Stream the result from the chosen path ---
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }}

    } catch (error) {
        console.error("\n!!! Error in Unified RAG pipeline !!!", error);
        // ... (your error handling)
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