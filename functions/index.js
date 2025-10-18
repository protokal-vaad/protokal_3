// functions/index.js (FINAL ROBUST FILE HANDLING VERSION)

const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const {SecretManagerServiceClient} = require("@google-cloud/secret-manager");
const {ImageAnnotatorClient} = require("@google-cloud/vision");
const vision = new ImageAnnotatorClient();

// Node.js built-in modules for file system operations
const path = require("path");
const os = require("os");
const fs = require("fs");

// Third-party libraries
const {Pinecone} = require("@pinecone-database/pinecone");
const {OpenAI} = require("openai");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

// Initialize core services
initializeApp();
const db = getFirestore();
const storage = getStorage();
const secretManager = new SecretManagerServiceClient();

// --- Helper Functions ---

// Fetches secrets securely from Google Secret Manager
async function accessSecret(secretName) {
    const projectId = "protokal-v3"; // Hard-coded project ID for reliability
    if (!projectId) {
        throw new Error("Google Cloud Project ID is not defined in the function.");
    }
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    try {
        const [version] = await secretManager.accessSecretVersion({name: name});
        return version.payload.data.toString("utf8");
    } catch (error) {
        console.error(`Failed to access secret "${secretName}" in project "${projectId}"`, error);
        throw new Error(`Could not access secret: ${secretName}`);
    }
}

// Finds the corresponding Firestore document for an uploaded file
async function getFirestoreDocRef(filePath) {
  const filesRef = db.collection("uploadedFiles");
  const snapshot = await filesRef.where("gcsPath", "==", filePath).limit(1).get();
  if (snapshot.empty) {
    console.error(`No Firestore document found for path: ${filePath}`);
    return null;
  }
  return snapshot.docs[0].ref;
};

async function parseFileContentFromPath(contentType, gcsPath) {
    const bucket = storage.bucket();
    const file = bucket.file(gcsPath);

    if (contentType === "application/pdf") {
        console.log("PDF detected. Starting asynchronous OCR batch processing...");

        const gcsSourceUri = `gs://${bucket.name}/${gcsPath}`;
        // Create a unique destination in the same bucket for the OCR output
        const gcsDestinationUri = `gs://${bucket.name}/ocr_results/${path.basename(gcsPath, '.pdf')}/`;

        const request = {
            requests: [{
                inputConfig: {
                    gcsSource: { uri: gcsSourceUri },
                    mimeType: "application/pdf",
                },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
                outputConfig: {
                    gcsDestination: { uri: gcsDestinationUri },
                    batchSize: 1, // Process one page per output file
                },
            },],
        };

        try {
            // 1. Submit the asynchronous job
            const [operation] = await vision.asyncBatchAnnotateFiles(request);
            console.log("OCR job submitted. Waiting for completion...");

            // 2. Wait for the job to complete
            const [filesResponse] = await operation.promise();
            console.log("OCR job completed.");

            // 3. Find and assemble the text from the output files
            const destinationBucket = storage.bucket();
            const [outputFiles] = await destinationBucket.getFiles({ prefix: `ocr_results/${path.basename(gcsPath, '.pdf')}/` });
            
            let fullText = "";
            for (const outputFile of outputFiles) {
                if (outputFile.name.endsWith('.json')) {
                    const [buffer] = await outputFile.download();
                    const json = JSON.parse(buffer.toString());
                    // The text is nested inside the first response
                    if (json.responses[0]?.fullTextAnnotation?.text) {
                        fullText += json.responses[0].fullTextAnnotation.text;
                    }
                }
            }

            // 4. Clean up the OCR result files
            console.log(`Cleaning up ${outputFiles.length} OCR result files...`);
            await Promise.all(outputFiles.map(f => f.delete()));
            
            if (fullText.trim().length > 0) {
                return fullText;
            } else {
                throw new Error("Asynchronous OCR completed but found no text.");
            }

        } catch (error) {
            console.error("Error during asynchronous OCR process:", error);
            throw new Error(`Failed to process PDF with asynchronous OCR: ${error.message}`);
        }

    } else if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // Docx logic is simpler: download and parse
        const tempFilePath = path.join(os.tmpdir(), path.basename(gcsPath));
        await file.download({ destination: tempFilePath });
        const buffer = fs.readFileSync(tempFilePath);
        fs.unlinkSync(tempFilePath); // Clean up immediately
        const { value } = await mammoth.extractRawText({ buffer });
        return value;

    } else if (contentType === "text/plain") {
        const [buffer] = await file.download();
        return buffer.toString("utf-8");
    } else {
        throw new Error(`Unsupported content type for parsing: ${contentType}`);
    }
}

// Splits text into chunks
function chunkText(text, targetChunkSize = 1500) {
    // 1. Normalize line endings and split into paragraphs based on double newlines.
    const paragraphs = text.replace(/(\r\n|\r)/g, '\n').split(/[\n]{2,}/).map(p => p.trim()).filter(p => p.length > 20);

    if (paragraphs.length === 0) {
        console.warn("No paragraph breaks found. Falling back to simple sliding window on raw text.");
        const chunks = [];
        for (let i = 0; i < text.length; i += (targetChunkSize - 200)) { // 200 is overlap
            chunks.push(text.substring(i, i + targetChunkSize));
        }
        return chunks.filter(c => c.length > 20);
    }

    // 2. Intelligently group paragraphs into meaningful chunks.
    const chunks = [];
    let currentChunk = "";
    for (const p of paragraphs) {
        const isHeading = /^\d+(\.\d+)*\s/.test(p);
        if (currentChunk && isHeading) {
            chunks.push(currentChunk);
            currentChunk = "";
        }
        if ((currentChunk + "\n\n" + p).length <= targetChunkSize) {
            currentChunk += (currentChunk ? "\n\n" : "") + p;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = p;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    console.log(`Text processed. Paragraphs found: ${paragraphs.length}, Chunks created: ${chunks.length}`);
    return chunks;
}

// Global variables for clients to reuse across function invocations
let openai;
let pineconeIndex;

// A single, reusable function to initialize all clients
async function initializeClients() {
    // If clients are already warm, do nothing.
    if (openai && pineconeIndex) {
        return;
    }
    
    console.log("Initializing API clients with Pinecone SDK v2...");
    try {
        const openAIKey = await accessSecret("OPENAI_API_KEY");
        const pineconeKey = await accessSecret("PINECONE_API_KEY");
        
        openai = new OpenAI({apiKey: openAIKey});
        
        // Use the simple, modern Pinecone v2 initialization that works
        const pinecone = new Pinecone({ apiKey: pineconeKey });
        pineconeIndex = pinecone.Index("protokal-ai");

        console.log("Clients initialized successfully.");
    } catch (initError) {
        console.error("CRITICAL: Failed to initialize clients.", initError);
        // Re-throw the error so the calling function knows to stop
        throw initError; 
    }
}

// --- MAIN CLOUD FUNCTION ---
exports.processUploadedFile = onObjectFinalized({
    timeoutSeconds: 540,
    memory: "1GiB",
	concurrency: 50,
	retryConfig: {
        maxRetryAttempts: 3,
        maxBackoffSeconds: 600
    }
}, async (event) => {
  
    try {
        // Just call the new, reusable initializer
        await initializeClients(); 
    } catch (e) {
        // If initialization fails, update the Firestore doc and exit
        const docRefOnError = await getFirestoreDocRef(event.data.name);
        if (docRefOnError) {
            await docRefOnError.update({status: "error", errorMessage: "Client initialization failed."});
        }
        return; // Stop execution
    }

    const filePath = event.data.name;
    const contentType = event.data.contentType;
    const docRef = await getFirestoreDocRef(filePath);
    if (!docRef) {
        console.log("No matching Firestore document. Exiting function.");
        return null;
    }

    // Define a temporary path for the downloaded file
    const tempFileName = path.basename(filePath);
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

	// --- Replacement for the try...catch...finally block ---
	try {
		await docRef.update({status: "processing"});
		const textContent = await parseFileContentFromPath(contentType, filePath);

        if (!textContent || !textContent.trim()) { throw new Error("Could not extract text."); }
		
		const file = storage.bucket(event.data.bucket).file(filePath);
		await file.download({ destination: tempFilePath });
		console.log(`File downloaded to: ${tempFilePath}`);
		
		// Check the downloaded file directly on the disk
		if (!fs.existsSync(tempFilePath)) {
			throw new Error("Validation failed: Temporary file does not exist after download.");
		}
		const stats = fs.statSync(tempFilePath);
		console.log(`VALIDATION: Temporary file exists. Size: ${stats.size} bytes.`);
		if (stats.size === 0) {
			throw new Error("Validation failed: Temporary file is empty (0 bytes).");
		}
		
		//const textContent = await parseFileContentFromPath(contentType, tempFilePath);
		console.log(`Parsing complete. Extracted text length: ${textContent ? textContent.length : 'null or undefined'}`);
		if (!textContent || textContent.trim() === "") {
			throw new Error("Could not extract text or file is empty.");
		}
		
		console.log("Attempting to extract document date from text...");
		const documentDate = extractDateFromText(textContent);
		if (documentDate) {
			console.log("Found document date:", documentDate.toISOString());
			// Update the Firestore document with the extracted date
			await docRef.update({ documentDate: documentDate });
		} else {
			console.warn("Could not find a date in the document text.");
			// We can optionally save the upload date as a fallback
			const fileMetadata = await file.getMetadata();
			const createdDate = new Date(fileMetadata[0].timeCreated);
			await docRef.update({ documentDate: createdDate });
		}

		const textChunks = chunkText(textContent);
		console.log(`Split into ${textChunks.length} chunks.`);
		
		console.log(`Creating embeddings for ${textChunks.length} chunks...`);
		const embeddingsResponse = await openai.embeddings.create({
			model: "text-embedding-3-small",
			input: textChunks,
		});
		
		const pathParts = filePath.split('/');
		const categoryId = pathParts.length > 1 ? pathParts[0] : 'unknown';

		const vectors = [];
		for (let i = 0; i < embeddingsResponse.data.length; i++) {
			const embedding = embeddingsResponse.data[i];
			const chunk = textChunks[i];

			// VALIDATION: Ensure the embedding has data and the chunk is not empty
			if (embedding.embedding && embedding.embedding.length > 0 && chunk) {
				vectors.push({
					id: `${docRef.id}-chunk-${i}`,
					values: embedding.embedding,
					metadata: {
						text: chunk,
						firestoreDocId: docRef.id,
						filePath: filePath,
						filename: tempFileName,
						categoryId: categoryId
					},
				});
			} else {
				console.warn(`Skipping chunk #${i} for file ${filePath} due to missing embedding or text.`);
			}
		}

		if (vectors.length === 0) {
			throw new Error("No valid vector embeddings were generated from the document.");
		}
		
		console.log(`Attempting to upsert ${vectors.length} vectors to Pinecone.`);
		// Log a small sample to verify its structure before sending
		const sampleVector = vectors[0];
		console.log(`Sample vector ID: ${sampleVector.id}, Values length: ${sampleVector.values.length}, Metadata text snippet: "${sampleVector.metadata.text.substring(0, 50)}..."`);

		// This is the call that sends the data to Pinecone
		await pineconeIndex.upsert(vectors);
		console.log("SUCCESS: Pinecone upsert command completed.");
		
		const vectorIds = vectors.map(v => v.id);
		
		await docRef.update({
			status: "completed",
			pineconeVectorIds: vectorIds
		});
		console.log("Processing complete for:", filePath);

	} catch (error) {
		// Add more detailed error logging
		console.error(`--- ERROR processing file: ${filePath} ---`);
		console.error(error); // Log the full error object for more details
		await docRef.update({status: "error", errorMessage: error.message});
	} //finally {
		// if (fs.existsSync(tempFilePath)) {
			// fs.unlinkSync(tempFilePath);
			// console.log(`Cleaned up temporary file: ${tempFilePath}`);
		// }
	// }
});

const {onCall} = require("firebase-functions/v2/https");

exports.deleteFiles = onCall(async (request) => {
	try {
        // Just call the new, reusable initializer
        await initializeClients();
    } catch (e) {
        // If initialization fails, throw a user-facing error
        throw new onCall.HttpsError("internal", "Could not initialize API clients. See function logs for details.");
    }

    const docIds = request.data.docIds;
    if (!Array.isArray(docIds) || docIds.length === 0) {
        throw new onCall.HttpsError("invalid-argument", "The function must be called with an array of document IDs.");
    }

    console.log(`Received request to delete ${docIds.length} files.`);

    const deletePromises = docIds.map(async (docId) => {
        try {
            const docRef = db.collection("uploadedFiles").doc(docId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                console.log(`Document ${docId} not found, skipping.`);
                return;
            }

            const fileData = docSnap.data();

            // 1. Delete from Cloud Storage
            if (fileData.gcsPath) {
                await storage.bucket().file(fileData.gcsPath).delete();
                console.log(`Deleted from Storage: ${fileData.gcsPath}`);
            }

            // 2. Delete from Pinecone
            if (fileData.pineconeVectorIds && fileData.pineconeVectorIds.length > 0) {
                await pineconeIndex.deleteMany(fileData.pineconeVectorIds);
                console.log(`Deleted ${fileData.pineconeVectorIds.length} vectors from Pinecone for doc ${docId}`);
            }

            // 3. Delete from Firestore
            await docRef.delete();
            console.log(`Deleted from Firestore: ${docId}`);
        } catch (error) {
            console.error(`Failed to delete file with doc ID ${docId}:`, error);
            // We don't throw an error here, so the process can continue with other files.
        }
    });

    await Promise.all(deletePromises);

    return { success: true, message: `Attempted to delete ${docIds.length} files.` };
});

function extractDateFromText(text) {
    // Look only at the top of the document for the date
    const textSnippet = text.substring(0, 500);

    // --- NEW: Hebrew month mapping ---
    const hebrewMonths = {
        "ינואר": 0, "פברואר": 1, "מרץ": 2, "אפריל": 3, "מאי": 4, "יוני": 5,
        "יולי": 6, "אוגוסט": 7, "ספטמבר": 8, "אוקטובר": 9, "נובמבר": 10, "דצמבר": 11
    };
    // ---

    // Regex for numeric dates: dd.mm.yyyy, dd/mm/yy, etc.
    let match = textSnippet.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (match) {
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
        const day = parseInt(match[1], 10);
        return new Date(year, month, day);
    }

    // --- NEW: Regex for Hebrew month dates: "09 אפריל 22" ---
    const monthNamesRegex = new RegExp(`(\\d{1,2})\\s+(${Object.keys(hebrewMonths).join('|')})\\s+(\\d{2,4})`);
    match = textSnippet.match(monthNamesRegex);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = hebrewMonths[match[2]];
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        return new Date(year, month, day);
    }
    // ---

    // Add more regex patterns here for other formats if needed

    console.warn("No parsable date found in the first 500 characters of the document.");
    return null; // Return null if no formats match
}