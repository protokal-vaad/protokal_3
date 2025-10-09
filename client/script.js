// client/script.js (FINAL, COMPLETE, AND CORRECTLY ORDERED)

document.addEventListener('DOMContentLoaded', () => {
    
    // --- PART 1: VALIDATE FIREBASE ---
    if (typeof firebase === 'undefined' || typeof db === 'undefined' || typeof storage === 'undefined') {
        console.error("Firebase services are not initialized. Check firebase-init.js and your index.html.");
        alert("CRITICAL ERROR: Could not connect to the database. App cannot start.");
        return;
    }

    // --- PART 2: ELEMENT SELECTORS ---
    const chatPage = document.getElementById('chat-page');
    const settingsPage = document.getElementById('settings-page');
    const fileUploadPage = document.getElementById('file-upload-page');
    const emptyStateContainer = document.getElementById('empty-state-container');
    const protocolMenuItem = document.getElementById('protocol-menu-item');
    const sidebarMenu = document.getElementById('sidebar-menu');
    const chatTitle = document.getElementById('chat-title');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const messagesContainer = document.getElementById('messages-container');
    const chatWindow = document.getElementById('chat-window');
    const sendBtn = document.getElementById('send-btn');
    const menuToggleBtn = document.getElementById('menu-toggle');
    const closeMenuBtn = document.getElementById('close-menu');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const newCategoryNameInput = document.getElementById('new-category-name');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoriesList = document.getElementById('categories-list');
    const saveOrderBtn = document.getElementById('save-order-btn');
    const uploadCategorySelect = document.getElementById('upload-category-select');
    const existingFilesList = document.getElementById('existing-files-list');
    const uploadActionArea = document.getElementById('upload-action-area');
    const uploadFilesBtn = document.getElementById('upload-files-btn');
    const uploadProgressContainer = document.getElementById('upload-progress-container');
    const deleteFilesBtnTop = document.getElementById('delete-files-btn-top');
    const deleteFilesBtnBottom = document.getElementById('delete-files-btn-bottom');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const emptyStateLink = document.getElementById('empty-state-link');
    const auditLogList = document.getElementById('audit-log-list');
    const logActionFilter = document.getElementById('log-action-filter');
    const detailsModal = document.getElementById('details-modal');
    const modalDetailsContent = document.getElementById('modal-details-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const exportLogsBtn = document.getElementById('export-logs-btn');
	const logUserFilter = document.getElementById('log-user-filter');
    const logDateStart = document.getElementById('log-date-start');
    const logDateEnd = document.getElementById('log-date-end');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const copyHistoryBtn = document.getElementById('copy-history-btn');
    
    // --- PART 3: FIREBASE REFERENCES ---
    const categoriesCollection = db.collection("categories");
    const uploadedFilesCollection = db.collection("uploadedFiles");
    
    // --- PART 4: APP STATE & CONFIG ---
	let appSettings = { isTaknonChatEnabled: false };
    let currentChatType = 'protocol';
	let allCategories = []; // A single, unified list for ALL categories
	let sortableInstance = null;
	const chatHistories = {}; // Start empty, will be populated dynamically
	const chatConfig = {
		// We only need to pre-define the static 'taknon' chat if it's in the HTML
		taknon: { title: "צאט עם התקנון", greeting: `היי! אני פרוטו-קל, העוזר הוירטואלי שלכם...` }
	};
    
    // --- PART 5: FUNCTION DEFINITIONS ---
	function setActiveMenuItem(menuItem) {
		sidebarMenu.querySelectorAll('li').forEach(item => item.classList.remove('active'));
		if (menuItem) {
			menuItem.classList.add('active');
			const parentContainer = menuItem.closest('.has-submenu');
			if (parentContainer) {
				parentContainer.classList.add('active');
                parentContainer.classList.add('open');
			}
		}
	}
    function checkAdminMode() {
        const isAdminPath = window.location.pathname.includes('/admin');
        const adminItems = document.querySelectorAll('.admin-only');
        adminItems.forEach(item => {
            item.style.display = isAdminPath ? 'list-item' : 'none';
        });
    }
    function showPage(pageToShow) {
        if (chatPage) chatPage.style.display = 'none';
        if (settingsPage) settingsPage.style.display = 'none';
        if (fileUploadPage) fileUploadPage.style.display = 'none';
        if (emptyStateContainer) emptyStateContainer.style.display = 'none';

        if (pageToShow) {
            pageToShow.style.display = (pageToShow === chatPage || pageToShow === emptyStateContainer) ? 'flex' : 'block';
        }
    }
    function createMessageElement(text, senderType) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message-wrapper ${senderType}-message-wrapper`;
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
        messageWrapper.innerHTML = `<div class="message-content"><button class="copy-btn" title="העתק תוכן"><i class="fa-regular fa-copy"></i></button><div class="message"><p>${text.replace(/\n/g, '<br>')}</p></div></div><span class="message-timestamp">${timeString}</span>`;
        return messageWrapper;
    }
    function addMessageToCurrentChat(text, senderType, saveToHistory = true) {
        if (saveToHistory) {
            if (!chatHistories[currentChatType]) {
                chatHistories[currentChatType] = [];
            }
            chatHistories[currentChatType].push({ text, sender: senderType });
        }
        const messageElement = createMessageElement(text, senderType);
        if(messagesContainer) messagesContainer.appendChild(messageElement);
        if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
        return messageElement;
    }
    async function getOpenAiStreamingResponse(userText, activeChatType) { 
        const startTime = Date.now(); // FIX for logging
        userInput.disabled = true;
        sendBtn.disabled = true;
		const aiMessageElement = addMessageToCurrentChat("חושב", 'ai', false);
		const messageParagraph = aiMessageElement.querySelector('.message p');
		messageParagraph.classList.add('thinking-indicator');
		let fullResponse = "";
		try {
            const history = chatHistories[activeChatType] ? chatHistories[activeChatType].slice(-4) : [];
			const response = await fetch('/api/chat-stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: userText, chatType: activeChatType, history: history }),
			});
			if (!response.body) throw new Error("Response body is null");
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let firstChunk = true;
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				const chunkText = decoder.decode(value);
				const lines = chunkText.split('\n\n').filter(line => line.trim());
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.substring(6);
						if (data === '[DONE]') {
							messageParagraph.classList.remove('thinking-indicator');
							return;
						}
						const parsed = JSON.parse(data);
						if (parsed.content) {
							if (firstChunk) {
								messageParagraph.textContent = "";
								messageParagraph.classList.remove('thinking-indicator');
								messageParagraph.style.color = '';
								firstChunk = false;
							}
							fullResponse += parsed.content;
							messageParagraph.innerHTML = fullResponse.replace(/\n/g, '<br>');
							if(chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
						} else if (parsed.error) {
							throw new Error(parsed.details || parsed.error);
						}
					}
				}
			}
		} catch (error) {
			console.error("Error fetching AI response:", error);
			messageParagraph.textContent = `אופס, משהו השתבש. (${error.message})`;
		} finally {
            const endTime = Date.now();
			const duration = (endTime - startTime) / 1000;
			logAuditEvent(
				'CHAT_QUERY',
				`שאילתה נשלחה לצ'אט. משך התגובה: ${duration.toFixed(2)} שניות`,
				{ query: userText, category: chatConfig[activeChatType]?.title || activeChatType, durationSeconds: duration, responseLength: fullResponse.length }
			);
			messageParagraph.classList.remove('thinking-indicator');
			if (fullResponse) {
                if (!chatHistories[activeChatType]) {
                    chatHistories[activeChatType] = [];
                }
				chatHistories[activeChatType].push({ text: fullResponse, sender: 'ai' });
			}
			userInput.disabled = false;
			sendBtn.disabled = false;
			setTimeout(() => {
				userInput.focus();
			}, 0);
		}
	}
    function setAppHeight() {
        const doc = document.documentElement;
        doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    }
    function openSidebar() { document.body.classList.add('sidebar-open'); }
    function closeSidebar() { document.body.classList.remove('sidebar-open'); }
	async function fetchAndRenderAll() {
		// 1. Fetch global app settings
        try {
            const settingsDoc = await db.collection('appSettings').doc('global').get();
            if (settingsDoc.exists) appSettings = settingsDoc.data();
        } catch (error) { console.error("Error fetching app settings:", error); }
        
        // 2. Fetch all categories
        try {
            const snapshot = await categoriesCollection.orderBy("order", "asc").get();
            allCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) { console.error("Error fetching categories:", error); }

        // 3. Render UI components that depend on this data
        renderSidebarMenu();
        populateCategoryDropdown();
        
        // 4. Update the toggle switch in the UI
        const taknonToggleCheckbox = document.getElementById('taknon-toggle-checkbox');
        if (taknonToggleCheckbox) taknonToggleCheckbox.checked = appSettings.isTaknonChatEnabled;
    }
	function renderSidebarMenu() {
		const protocolSubmenu = document.getElementById('protocol-submenu');
		const taknonMenuItem = sidebarMenu.querySelector('li[data-chat-type="taknon"]');

		if (!protocolSubmenu || !taknonMenuItem) return;

		protocolSubmenu.innerHTML = ''; 
		const protocolCategories = allCategories.filter(cat => cat.id !== 'taknon');
		
		protocolCategories.forEach(category => {
			const li = document.createElement('li');
			li.dataset.chatType = category.id;
			li.innerHTML = `<a href="#">${category.name}</a>`;
			protocolSubmenu.appendChild(li);
			chatConfig[category.id] = { title: `צאט עם ${category.name}`, greeting: `שאל אותי...` };
		});
		
		// Control Taknon visibility with the feature flag
		taknonMenuItem.style.display = appSettings.isTaknonChatEnabled ? 'list-item' : 'none';
	}
	async function populateCategoryDropdown() {
		const uploadCategorySelect = document.getElementById('upload-category-select');
		if (!uploadCategorySelect) {
			console.error("DEBUG: `uploadCategorySelect` element not found. Aborting.");
			return;
		}
		
		uploadCategorySelect.innerHTML = '<option value="" disabled selected>-- בחר קטגוריה --</option>';
		
		console.log("--- DEBUG: Starting populateCategoryDropdown ---");
		console.log("Current appSettings.isTaknonChatEnabled:", appSettings.isTaknonChatEnabled);

		try {
			console.log("Fetching ALL categories directly from Firestore for dropdown...");
			const snapshot = await categoriesCollection.orderBy("order", "asc").get();

			if (snapshot.empty) {
				console.warn("DEBUG: Firestore query returned no categories.");
				return;
			}

			console.log(`DEBUG: Found ${snapshot.size} categories in Firestore.`);

			snapshot.forEach(doc => {
				const category = { id: doc.id, ...doc.data() };
				console.log(`  Processing category: ID=${category.id}, Name=${category.name}`);

				if (category.id === 'taknon' && !appSettings.isTaknonChatEnabled) {
					console.log("    -> Skipping 'taknon' because its feature flag is disabled.");
					return; // The 'continue' statement for a forEach loop
				}

				console.log(`    -> Adding '${category.name}' to the dropdown.`);
				const option = document.createElement('option');
				option.value = category.id;
				option.textContent = category.name;
				uploadCategorySelect.appendChild(option);
			});

		} catch (error) {
			console.error("--- DEBUG: ERROR in populateCategoryDropdown ---", error);
		}
		console.log("--- DEBUG: Finished populateCategoryDropdown ---");
	}
	async function renderCategoriesForSettings() { 
		if (!categoriesList) return;
		categoriesList.innerHTML = '<li>טוען רשימה...</li>';
		
		// Use the existing 'allCategories' array, but only show the protocol ones for sorting
		const protocolCategories = allCategories.filter(cat => cat.id !== 'taknon');
		
		if (protocolCategories.length === 0) {
			categoriesList.innerHTML = '<li>עדיין לא הוספו קטגוריות.</li>';
			return;
		}
		
		categoriesList.innerHTML = '';
		protocolCategories.forEach(category => {
			const li = document.createElement('li');
			li.dataset.id = category.id;
			li.innerHTML = `<span><i class="fa-solid fa-grip-vertical"></i> ${category.name}</span><button class="delete-btn" ...></button>`;
			categoriesList.appendChild(li);
		});

		if (sortableInstance) sortableInstance.destroy();
		if (typeof Sortable !== 'undefined') {
			sortableInstance = new Sortable(categoriesList, { /* ... */ });
		}
	}
    function renderCurrentChatHistory() {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        
        // This line is the fix. If history for the current chat doesn't exist, use an empty array.
        const history = chatHistories[currentChatType] || []; 
        
        if (!chatConfig[currentChatType]) return; // Safety check
        
        if (history.length === 0) {
            addMessageToCurrentChat(chatConfig[currentChatType].greeting, 'ai', false);
        } else {
            history.forEach(msg => { messagesContainer.appendChild(createMessageElement(msg.text, msg.sender)); });
            if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    }
    function switchChat(newType) {
        if (!chatConfig[newType]) {
			console.error(`Cannot switch chat: config for type "${newType}" not found.`);
			return;
		}
		currentChatType = newType;
		if (!chatHistories[currentChatType]) {
			chatHistories[currentChatType] = [];
		}
		chatTitle.textContent = chatConfig[newType].title;
		renderCurrentChatHistory();
    }
    function updateDeleteButtonsVisibility() {
		const checkedBoxes = existingFilesList.querySelectorAll('.file-checkbox:checked');
		const show = checkedBoxes.length > 0;
		if (deleteFilesBtnTop) deleteFilesBtnTop.style.display = show ? 'inline-flex' : 'none';
		if (deleteFilesBtnBottom) deleteFilesBtnBottom.style.display = show ? 'block' : 'none';
		const allCheckboxes = existingFilesList.querySelectorAll('.file-checkbox');
		selectAllCheckbox.checked = allCheckboxes.length > 0 && checkedBoxes.length === allCheckboxes.length;
		selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allCheckboxes.length;
	}
	async function displayExistingFiles(categoryId) {
		const fileListBody = document.getElementById('existing-files-list');
		if (!fileListBody) return;
		fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">טוען קבצים...</td></tr>';
		
		try {
			const querySnapshot = await uploadedFilesCollection
				.where("categoryId", "==", categoryId)
				.orderBy("fileName", "asc")
				.get();

			if (querySnapshot.empty) {
				fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">לא הועלו קבצים לקטגוריה זו.</td></tr>';
			} else {
				fileListBody.innerHTML = ''; // Clear the list
				querySnapshot.forEach(doc => {
					const file = { id: doc.id, ...doc.data() };
					const tr = document.createElement('tr');
					const statusText = file.status || 'pending';
					const uploadDate = file.uploadedAt?.seconds ? 
						new Date(file.uploadedAt.seconds * 1000).toLocaleDateString('he-IL') : 
						'לא ידוע';

					tr.innerHTML = `
						<td class="col-check"><input type="checkbox" class="file-checkbox" data-doc-id="${file.id}"></td>
						<td class="col-name">${file.fileName}</td>
						<td class="col-date">${uploadDate}</td>
						<td class="col-status"><span class="file-status ${statusText}">${statusText}</span></td>
					`;
					fileListBody.appendChild(tr);
				});
			}
		} catch (error) {
			console.error("Error fetching existing files:", error);
			fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">שגיאה בטעינת קבצים.</td></tr>';
		} finally {
			// --- THIS IS THE FIX for the delete buttons ---
			// Always update button visibility after the list is rendered or re-rendered.
			updateDeleteButtonsVisibility();
			// --- END OF FIX ---
		}
	}
	function uploadFile(file, categoryId) {
		const fileName = file.name;
		// We create a folder structure in Storage for better organization: categoryId/fileName
		const filePath = `${categoryId}/${fileName}`;
		const storageRef = storage.ref(filePath);
		
		const progressId = `progress-${Date.now()}-${Math.random().toString(36).substring(2)}`;

		const progressElement = document.createElement('div');
		progressElement.className = 'upload-progress-item';
		progressElement.innerHTML = `
			<span class="file-name">${fileName}</span>
			<div class="progress-bar-container">
				<div id="${progressId}" class="progress-bar" style="width: 0%;"></div>
			</div>
			<span class="progress-text">0%</span>
		`;
		if (uploadProgressContainer) {
			uploadProgressContainer.appendChild(progressElement);
		}
		
		const uploadTask = storageRef.put(file);

		uploadTask.on('state_changed', 
			(snapshot) => {
				// Progress update
				const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
				const progressBar = document.getElementById(progressId);
				const progressText = progressElement.querySelector('.progress-text');
				if (progressBar) progressBar.style.width = progress + '%';
				if (progressText) progressText.textContent = Math.round(progress) + '%';
			}, 
			(error) => {
				// Handle error
				console.error(`Upload failed for ${fileName}:`, error);
				const progressText = progressElement.querySelector('.progress-text');
				if (progressText) {
					progressText.textContent = 'שגיאה';
					progressText.parentElement.style.color = 'red';
				}
			}, 
			async () => {
				// Handle completion
				const progressText = progressElement.querySelector('.progress-text');
				const progressBarContainer = progressElement.querySelector('.progress-bar-container');
				if (progressText) progressText.textContent = 'הושלם';
				if (progressBarContainer) progressBarContainer.querySelector('.progress-bar').style.backgroundColor = '#28a745'; // Green for success
				
				// Add a record to Firestore to track the file
				try {
					const docRef = await uploadedFilesCollection.add({
						fileName: fileName,
						categoryId: categoryId,
						gcsPath: filePath, // Full path in Google Cloud Storage
						status: 'pending', // Waiting for the Cloud Function to process it
						uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
					});
					const category = categories.find(c => c.id === categoryId);
					const categoryName = category ? category.name : 'Unknown';
					logAuditEvent('FILE_UPLOADED', `הקובץ '${file.name}' הועלה לקטגוריה '${categoryName}'`, { fileName: file.name, categoryId: categoryId, docId: docRef.id });
					console.log(`Firestore record created for ${fileName}`);
					// Refresh the list of existing files to show the new one instantly
					displayExistingFiles(categoryId);
				} catch (firestoreError) {
					console.error(`Failed to create Firestore record for ${fileName}:`, firestoreError);
				}
			}
		);
	}
	function resetUploadPage() {
		console.log("Resetting file upload page to default state.");
    
		// 1. Reset the category dropdown to its default "-- select --" option
		if (uploadCategorySelect) {
			uploadCategorySelect.value = "";
		}

		// 2. Hide the upload and delete buttons
		if (uploadActionArea) {
			uploadActionArea.style.display = 'none';
		}
		if (deleteFilesBtnTop) {
			deleteFilesBtnTop.style.display = 'none';
		}
		if (deleteFilesBtnBottom) {
			deleteFilesBtnBottom.style.display = 'none';
		}
		
		// 3. Clear the existing files list and show the initial message
		if (existingFilesList) {
			const fileListBody = document.getElementById('existing-files-list'); // This is the <tbody>
			if (fileListBody) {
				fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">בחר קטגוריה להצגת קבצים...</td></tr>';
			}
		}

		// 4. Clear any old upload progress bars
		if (uploadProgressContainer) {
			uploadProgressContainer.innerHTML = '';
		}

		// 5. Populate the dropdown with the latest categories
		populateCategoryDropdown();
	}
	async function logAuditEvent(action, description, details = {}) {
		if (typeof db === 'undefined') {
			console.error("Audit log failed: Firestore (db) is not available.");
			return;
		}
		
		// In the future, you would get the real user's details here.
		// For now, we assume it's an admin.
		const actor = {
			type: "admin",
			id: null,
			displayName: "Admin"
		};

		try {
			const auditLogsCollection = db.collection("auditLogs");
			await auditLogsCollection.add({
				action: action,
				description: description,
				details: details,
				actor: actor,
				timestamp: firebase.firestore.FieldValue.serverTimestamp()
			});
			console.log(`Audit event logged: ${action}`);
		} catch (error) {
			console.error("Failed to log audit event:", error);
		}
	}
	async function renderAuditLogs() {
		if (!auditLogList) return;
		auditLogList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">טוען יומן אירועים...</td></tr>';

		try {
			// 1. Get values from ALL filters
			const selectedAction = logActionFilter.value;
			const selectedUser = logUserFilter.value;
			const startDate = logDateStart.value ? new Date(logDateStart.value) : null;
			const endDate = logDateEnd.value ? new Date(logDateEnd.value) : null;

			// 2. Start building the query, always ordering by timestamp
			let query = db.collection("auditLogs").orderBy("timestamp", "desc");

			// 3. Dynamically add "where" clauses based on filter selections
			if (selectedAction) {
				query = query.where("action", "==", selectedAction);
			}
			if (selectedUser) {
				// Note: This requires the 'actor.displayName' field to be indexed
				query = query.where("actor.displayName", "==", selectedUser);
			}
			if (startDate) {
				query = query.where("timestamp", ">=", startDate);
			}
			if (endDate) {
				// To include the entire end day, we set the time to the very end of that day
				endDate.setHours(23, 59, 59, 999);
				query = query.where("timestamp", "<=", endDate);
			}

			// Limit to the last 100 logs for performance (this is from your existing code)
			query = query.limit(100);

			const snapshot = await query.get();

			if (snapshot.empty) {
				auditLogList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">לא נמצאו אירועים התואמים לסינון.</td></tr>';
				return;
			}

			auditLogList.innerHTML = ''; // Clear the list
			snapshot.forEach(doc => {
				const log = { id: doc.id, ...doc.data() };
				const tr = document.createElement('tr');
				
				const logDate = log.timestamp?.seconds ? 
					new Date(log.timestamp.seconds * 1000).toLocaleString('he-IL') : 
					'לא ידוע';

				tr.innerHTML = `
					<td class="col-timestamp">${logDate}</td>
					<td class="col-description">${log.description}</td>
					<td class="col-actor">${log.actor.displayName}</td>
					<td class="col-details">
						<button class="details-btn" data-details='${JSON.stringify(log.details)}' title="הצג פרטים">
							<i class="fa-solid fa-eye"></i>
						</button>
					</td>
				`;
				auditLogList.appendChild(tr);
			});

		} catch (error) {
			console.error("Error fetching audit logs:", error);
			auditLogList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">שגיאה בטעינת יומן האירועים.</td></tr>';
			
			if (error.code === 'failed-precondition') {
				alert("שגיאה: יש ליצור אינדקס במסד הנתונים כדי לאפשר סינון. אנא בדוק את הלוגים בקונסול לקבלת קישור ליצירה.");
				console.warn("To fix this, create a composite index in Firestore. The link should be in the detailed error message in the browser console.");
			}
		}
	}
	async function exportLogs(format = 'json') {
		console.log(`Exporting logs as ${format}...`);
		try {
			const selectedAction = logActionFilter.value;
			const selectedUser = logUserFilter.value;
			const startDate = logDateStart.value ? new Date(logDateStart.value) : null;
			const endDate = logDateEnd.value ? new Date(logDateEnd.value) : null;

			let query = db.collection("auditLogs").orderBy("timestamp", "desc");
			if (selectedAction) { query = query.where("action", "==", selectedAction); }
			if (selectedUser) { query = query.where("actor.displayName", "==", selectedUser); }
			if (startDate) { query = query.where("timestamp", ">=", startDate); }
			if (endDate) { endDate.setHours(23, 59, 59, 999); query = query.where("timestamp", "<=", endDate); }
			
			query = query.limit(500);
			const snapshot = await query.get();
			if (snapshot.empty) {
				alert("לא נמצאו אירועים לייצוא.");
				return;
			}

			const logs = [];
			snapshot.forEach(doc => {
				const data = doc.data();
				// Ensure timestamp exists before trying to access its properties
				const timestamp = data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000).toISOString() : 'N/A';
				
				// Flatten the data for easier export
				logs.push({
					timestamp: timestamp,
					action: data.action || 'N/A',
					description: data.description || 'N/A',
					actor_type: data.actor?.type || 'N/A',
					actor_name: data.actor?.displayName || 'N/A',
					details: JSON.stringify(data.details || {}) // Keep details as a JSON string
				});
			});
			
			// Safety check: if after processing, the array is empty, stop.
			if (logs.length === 0) {
				alert("לא נמצאו אירועים לייצוא.");
				return;
			}

			// Dynamic Filename Generation (this part is correct)
			const now = new Date();
			const date = now.toLocaleDateString('en-GB').split('/').join('-'); // dd-mm-yyyy
			const time = now.toTimeString().split(' ')[0].replace(/:/g, ''); // hhmmss
			const fileName = `auditLog_${date}_${time}`;

			if (format === 'json') {
				downloadFile(JSON.stringify(logs, null, 2), `${fileName}.json`, 'application/json');
			} else if (format === 'csv') {
				// This code will now work because logs[0] is guaranteed to exist
				const headers = Object.keys(logs[0]);
				const csvRows = [
					headers.join(','), // Header row
					...logs.map(row => 
						headers.map(fieldName => 
							// Ensure the value exists before stringifying
							JSON.stringify(row[fieldName] || '', (key, value) => value === undefined ? '' : value)
						).join(',')
					)
				];
				const csvString = csvRows.join('\r\n');
				downloadFile(csvString, `${fileName}.csv`, 'text/csv;charset=utf-8;');
			}

		} catch (error) {
			console.error("Error exporting logs:", error);
			alert("שגיאה בייצוא יומן האירועים.");
		}
	}
	function downloadFile(content, fileName, contentType) {
		// We need to add a BOM for Excel to open UTF-8 CSVs correctly
		const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
		const blob = new Blob([bom, content], { type: contentType });

		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = fileName;
		document.body.appendChild(a); // Required for Firefox
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(a.href);
	}
	async function fetchCategories() {
		if (!categoriesCollection) {
			allCategories = [];
			return;
		}
		try {
			const snapshot = await categoriesCollection.orderBy("order", "asc").get();
			allCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		} catch (error) {
			console.error("Error fetching categories:", error);
			allCategories = [];
		}
	}
	
	// --- PART 6: EVENT LISTENERS ---
	window.addEventListener('resize', setAppHeight);
	if (emptyStateLink) {
		emptyStateLink.addEventListener('click', (e) => {
			e.preventDefault();
			showPage(settingsPage);
			setActiveMenuItem(settingsMenuBtn);
			renderCategoriesForSettings();
			const categoriesTabLink = document.querySelector('.tab-link[data-tab="categories-tab"]');
			const usersTabLink = document.querySelector('.tab-link[data-tab="users-tab"]');
			const categoriesTabContent = document.getElementById('categories-tab');
			const usersTabContent = document.getElementById('users-tab');

			if (categoriesTabLink && usersTabLink && categoriesTabContent && usersTabContent) {
				// Deactivate the users tab
				usersTabLink.classList.remove('active');
				usersTabContent.classList.remove('active');

				// Activate the categories tab
				categoriesTabLink.classList.add('active');
				categoriesTabContent.classList.add('active');
			}
		});
	}
	
	// Settings Page: Tab Listeners
	tabLinks.forEach(link => {
		link.addEventListener('click', () => {
			tabLinks.forEach(l => l.classList.remove('active'));
			link.classList.add('active');
			const tabId = link.dataset.tab;
			tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
			if (tabId === 'audit-log-tab') {
				renderAuditLogs();
			}
            
            // Re-initialize sorting when the categories tab is clicked
            if (tabId === 'categories-tab') {
                renderCategoriesForSettings();
            }
		});
	});

	// Settings Page: Category Management Listeners
	addCategoryBtn.addEventListener('click', async () => {
		if (!categoriesCollection) {
			console.error("Firestore not initialized.");
			return;
		}
		const categoryName = newCategoryNameInput.value.trim();
		if (categoryName) {
			try {
				// Find the highest current order number to ensure the new one is always last
				const highestOrder = allCategories.reduce((max, cat) => (cat.order > max ? cat.order : max), -1);

				const docRef = await categoriesCollection.add({ 
					name: categoryName, 
					createdAt: new Date(), 
					order: highestOrder + 1 // Assign a unique order number
				});

				logAuditEvent(
					'CATEGORY_CREATED', 
					`הקטגוריה '${categoryName}' נוצרה`, 
					{ categoryId: docRef.id, categoryName: categoryName }
				);

				newCategoryNameInput.value = '';

				// --- THIS IS THE FIX ---
				// After adding, re-fetch all data and re-render everything
				await fetchCategories(); // Re-fetch the complete 'allCategories' list
				renderSidebarMenu(); // Re-draw the sidebar
				renderCategoriesForSettings(); // Re-draw the settings panel list
				// --- END OF FIX ---

			} catch (error) {
				console.error("Error adding category:", error);
				alert("שגיאה בהוספת קטגוריה.");
			}
		}
	});

	categoriesList.addEventListener('click', async (e) => {
        // We only care about clicks on elements with the 'delete-btn' class
        if (e.target.classList.contains('delete-btn')) {
            const categoryId = e.target.dataset.id;
			const categoryName = e.target.closest('li').querySelector('span').innerText.trim();
            if (confirm("האם אתה בטוח?")) {
                try {
                    await categoriesCollection.doc(categoryId).delete();
					logAuditEvent('CATEGORY_DELETED', `הקטגוריה '${categoryName}' נמחקה`, { categoryId: categoryId, categoryName: categoryName });
                    await renderCategoriesForSettings(); // Refresh settings list
                    renderSidebarMenu(); // Refresh sidebar menu
                } catch (error) {
                    console.error("Error deleting category:", error);
                }
            }
        }
    });
	
	if (saveOrderBtn) {
        saveOrderBtn.addEventListener('click', async () => {
            if (!sortableInstance) return;
            const newOrderIds = sortableInstance.toArray();
            const batch = db.batch();

            newOrderIds.forEach((id, index) => {
                const docRef = categoriesCollection.doc(id);
                batch.update(docRef, { order: index });
            });

            try {
                await batch.commit();
				logAuditEvent('ORDER_SAVED', 'סדר הקטגוריות נשמר');
                alert("הסדר נשמר בהצלחה!");
                await fetchCategories(); // Refetch with the new order
                renderSidebarMenu(); // Refresh sidebar with the new order
            } catch (error) {
                console.error("Error saving order:", error);
                alert("שגיאה בשמירת הסדר.");
            }
        });
    }
		
	// Chat Form and Other UI Listeners
	chatForm.addEventListener('submit', (e) => {
		e.preventDefault();
		const userText = userInput.value.trim();
		if (userText && !userInput.disabled) {
			addMessageToCurrentChat(userText, 'user');
			userInput.value = '';
			userInput.style.height = 'auto';
			getOpenAiStreamingResponse(userText, currentChatType);
		}
	});
	menuToggleBtn.addEventListener('click', openSidebar);
	closeMenuBtn.addEventListener('click', closeSidebar);
	sidebarOverlay.addEventListener('click', closeSidebar);
	sidebarMenu.addEventListener('click', (e) => {
		const clickedElement = e.target;
		const clickedListItem = clickedElement.closest('li');
		if (!clickedListItem) return;

		// Handle submenu toggle
		if (clickedElement.closest('.submenu-toggle')) {
			e.preventDefault();
            const parentContainer = clickedElement.closest('.has-submenu');
			if (parentContainer) parentContainer.classList.toggle('open');
			return;
		}

		// Handle chat link clicks (static or dynamic)
		const chatType = clickedListItem.dataset.chatType;
		if (chatType) {
			e.preventDefault();
			setActiveMenuItem(clickedListItem);
			showPage(chatPage);
			switchChat(chatType);
			closeSidebar();
			return;
		}

		// Handle non-chat page links
		if (clickedListItem.id === 'menu-settings') {
			e.preventDefault();
			setActiveMenuItem(clickedListItem);
			showPage(settingsPage);
            // Render the initial tab content (e.g., users)
            const activeTab = settingsPage.querySelector('.tab-link.active')?.dataset.tab || 'users-tab';
            if (activeTab === 'categories-tab') renderCategoriesForSettings();
            if (activeTab === 'audit-log-tab') renderAuditLogs();
			closeSidebar();
			return;
		}
		if (clickedListItem.id === 'menu-files') {
			e.preventDefault();
			setActiveMenuItem(clickedListItem);
			showPage(fileUploadPage);
			resetUploadPage();
			closeSidebar();
			return;
		}
	});
	// Listener for when the admin selects a category
	uploadCategorySelect.addEventListener('change', () => {
		const selectedCategoryId = uploadCategorySelect.value;
		if (selectedCategoryId) {
			uploadActionArea.style.display = 'block'; // Show the upload button
			displayExistingFiles(selectedCategoryId); // Load the file list
		} else {
			uploadActionArea.style.display = 'none'; // Hide if default is selected
			existingFilesList.innerHTML = '<li>בחר קטגוריה להצגת קבצים...</li>';
		}
	});
	// Listener for the upload button (for now, it just opens the file dialog)
	uploadFilesBtn.addEventListener('click', () => {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.multiple = true;
		fileInput.accept = ".pdf,.doc,.docx,.txt";

		// This listener fires after the user selects files from the dialog
		fileInput.addEventListener('change', () => {
			const files = fileInput.files;
			if (files.length > 0) {
				console.log("Files selected:", files);

				const selectedCategoryId = uploadCategorySelect.value;
				if (!selectedCategoryId) {
					alert("Please select a category first.");
					return;
				}

				// Disable the button to prevent duplicate clicks while uploading
				uploadFilesBtn.disabled = true;
				uploadFilesBtn.textContent = "מעלה...";

				// Loop through each selected file and call our new uploadFile function
				Array.from(files).forEach(file => {
					uploadFile(file, selectedCategoryId);
				});

				// Re-enable the button after a moment
				setTimeout(() => {
					uploadFilesBtn.disabled = false;
					uploadFilesBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> בחר קבצים להעלאה';
				}, 3000); // 3 seconds
			}
		});

		fileInput.click(); // Open the file selection dialog
	});
	selectAllCheckbox.addEventListener('change', () => {
		const isChecked = selectAllCheckbox.checked;
		existingFilesList.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = isChecked);
		updateDeleteButtonsVisibility();
	});
	existingFilesList.addEventListener('change', (e) => {
		if (e.target.classList.contains('file-checkbox')) {
			updateDeleteButtonsVisibility();
		}
	});
    // When the action filter dropdown is changed, re-render the logs
    logActionFilter.addEventListener('change', renderAuditLogs);
    // Use event delegation for the "View Details" buttons
    auditLogList.addEventListener('click', (e) => {
        const detailsBtn = e.target.closest('.details-btn');
        if (detailsBtn) {
            const detailsData = detailsBtn.dataset.details;
            // Format the JSON string for pretty printing inside the <pre> tag
            modalDetailsContent.textContent = JSON.stringify(JSON.parse(detailsData), null, 2);
            detailsModal.style.display = 'flex'; // Show the modal
        }
    });
    // Function to close the modal
    function closeModal() {
        detailsModal.style.display = 'none';
    }
    // Close the modal when the close button is clicked
    modalCloseBtn.addEventListener('click', closeModal);
    // Close the modal when the overlay (background) is clicked
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) {
            closeModal();
        }
    });
    // Close the modal when the "Escape" key is pressed
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && detailsModal.style.display === 'flex') {
            closeModal();
        }
    });
	async function handleFileDeletion() {
		const checkedBoxes = existingFilesList.querySelectorAll('.file-checkbox:checked');
		if (checkedBoxes.length === 0) return;

		if (!confirm(`האם אתה בטוח שברצונך למחוק ${checkedBoxes.length} קבצים?`)) {
			return;
		}

		const docIdsToDelete = Array.from(checkedBoxes).map(cb => cb.dataset.docId);
		
		try {
			deleteFilesBtnTop.disabled = true;
			deleteFilesBtnBottom.disabled = true;
			deleteFilesBtnTop.textContent = 'מוחק...';
			deleteFilesBtnBottom.textContent = 'מוחק...';

			const deleteFilesFunction = firebase.functions().httpsCallable('deleteFiles');
			const result = await deleteFilesFunction({ docIds: docIdsToDelete });
			
			logAuditEvent('FILES_DELETED', `${docIdsToDelete.length} קבצים נמחקו`, { count: docIdsToDelete.length, docIds: docIdsToDelete });
			
			console.log("Delete function result:", result.data);
			alert(`${docIdsToDelete.length} קבצים נמחקו בהצלחה.`);

			// Reset "Select All" checkbox
			if (selectAllCheckbox) {
				selectAllCheckbox.checked = false;
			}
			
			// Refresh the file list to show the updated state
			const selectedCategoryId = uploadCategorySelect.value;
			await displayExistingFiles(selectedCategoryId);

			// --- THIS IS THE FIX ---
			// After the list is refreshed, explicitly hide the delete buttons.
			if (deleteFilesBtnTop) {
				deleteFilesBtnTop.style.display = 'none';
			}
			if (deleteFilesBtnBottom) {
				deleteFilesBtnBottom.style.display = 'none';
			}
			// --- END OF FIX ---

		} catch (error) {
			console.error("Error calling deleteFiles function:", error);
			alert(`שגיאה במחיקת קבצים: ${error.message}`);
		} finally {
			// This block runs regardless of success or failure
			deleteFilesBtnTop.disabled = false;
			deleteFilesBtnBottom.disabled = false;
			deleteFilesBtnTop.innerHTML = '<i class="fa-solid fa-trash-alt"></i> מחק נבחרים'; // Corrected text
			deleteFilesBtnBottom.innerHTML = '<i class="fa-solid fa-trash-alt"></i> מחק קבצים נבחרים';
		}
	}
	async function getOpenAiStreamingResponse(userText, activeChatType) { 
		const startTime = Date.now();
		userInput.disabled = true;
		sendBtn.disabled = true;
		const aiMessageElement = addMessageToCurrentChat("חושב", 'ai', false);
		const messageParagraph = aiMessageElement.querySelector('.message p');
		messageParagraph.classList.add('thinking-indicator');
		let fullResponse = "";
		try {
			const history = chatHistories[activeChatType] ? chatHistories[activeChatType].slice(-4) : [];
			const response = await fetch('/api/chat-stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: userText, chatType: activeChatType, history: history }),
			});
			if (!response.body) throw new Error("Response body is null");
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let firstChunk = true;
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				const chunkText = decoder.decode(value);
				const lines = chunkText.split('\n\n').filter(line => line.trim());
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.substring(6);
						if (data === '[DONE]') {
							messageParagraph.classList.remove('thinking-indicator');
							return;
						}
						const parsed = JSON.parse(data);
						if (parsed.content) {
							if (firstChunk) {
								messageParagraph.textContent = "";
								messageParagraph.classList.remove('thinking-indicator');
								messageParagraph.style.color = '';
								firstChunk = false;
							}
							fullResponse += parsed.content;
							messageParagraph.innerHTML = fullResponse.replace(/\n/g, '<br>');
							if(chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
						} else if (parsed.error) {
							throw new Error(parsed.details || parsed.error);
						}
					}
				}
			}
		} catch (error) {
			console.error("Error fetching AI response:", error);
			messageParagraph.textContent = `אופס, משהו השתבש. (${error.message})`;
		} finally {
			const endTime = Date.now();
			const duration = (endTime - startTime) / 1000;
			logAuditEvent(
				'CHAT_QUERY',
				`שאילתה נשלחה לצ'אט. משך התגובה: ${duration.toFixed(2)} שניות`,
				{ query: userText, category: chatConfig[activeChatType]?.title || activeChatType, durationSeconds: duration, responseLength: fullResponse.length }
			);
		
			messageParagraph.classList.remove('thinking-indicator');
			if (fullResponse) {
				if (!chatHistories[activeChatType]) {
					chatHistories[activeChatType] = [];
				}
				// Make sure the sender is correct for the history
				chatHistories[activeChatType].push({ text: fullResponse, sender: 'ai' });
			}
			userInput.disabled = false;
			sendBtn.disabled = false;
			
			// --- THIS IS THE FIX for the cursor ---
			// Remove the duplicate userInput.focus() and keep only the reliable setTimeout version.
			setTimeout(() => {
				userInput.focus();
			}, 0);
			// --- END OF FIX ---
		}
	}
	deleteFilesBtnTop.addEventListener('click', handleFileDeletion);
	deleteFilesBtnBottom.addEventListener('click', handleFileDeletion);
    // Listener for the "Copy Entire Chat History" button
    if (copyHistoryBtn) {
        copyHistoryBtn.addEventListener('click', async () => {
            console.log("Copy History button clicked!");
            try {
                let fullChatText = "פרוטוקול.ai - היסטוריית שיחה\n";
                fullChatText += `תאריך: ${new Date().toLocaleDateString('he-IL')}\n\n`; // Add current date for context

                if (window.chatHistory && window.chatHistory.length > 0) {
                    window.chatHistory.forEach(msg => {
                        const speakerLabel = msg.sender === 'user' ? 'משתמש' : 'פרוטוקול.ai';
                        fullChatText += `[${speakerLabel}]\n${msg.text}\n`; // Clearly label speaker

                        if (msg.sources && msg.sources.length > 0) {
                            fullChatText += `  (מקורות: ${msg.sources.join(', ')})\n`;
                        }
                        fullChatText += '\n'; // Extra newline for spacing between messages
                    });
                } else {
                    // Fallback: If chatHistory is not reliable or accessible, scrape from the UI
                    console.warn("chatHistory not found or empty, falling back to scraping UI.");
                    const messagesContainer = document.getElementById('messages-container');
                    if (messagesContainer) {
                        Array.from(messagesContainer.children).forEach(messageDiv => {
                            // Identify sender from class names
                            const speakerLabel = messageDiv.classList.contains('user-message-wrapper') ? 'משתמש' : 'פרוטוקול.ai';
                            const textElement = messageDiv.querySelector('.message p');
                            const sourcesElement = messageDiv.querySelector('.sources-info');

                            if (textElement) {
                                fullChatText += `[${speakerLabel}]: ${textElement.innerText.trim()}\n`;
                            }
                            if (sourcesElement) {
                                fullChatText += `  (${sourcesElement.innerText.trim()})\n`;
                            }
                            fullChatText += '\n';
                        });
                    }
                }

                // Copy to clipboard
                await navigator.clipboard.writeText(fullChatText);
                console.log('Full chat history copied to clipboard!');

                // Provide visual feedback
                const originalIcon = copyHistoryBtn.innerHTML;
                copyHistoryBtn.innerHTML = '<i class="fa-solid fa-check" style="color: green;"></i>';
                setTimeout(() => {
                    copyHistoryBtn.innerHTML = originalIcon;
                }, 1500);

            } catch (err) {
                console.error('Failed to copy full chat history:', err);
                alert("נכשל בהעתקת היסטוריית השיחה. אנא נסה שוב או העתק ידנית.");
            }
        });
    };
	if (messagesContainer) {
		messagesContainer.addEventListener('click', (e) => {
			// Find the closest 'copy-btn' that was clicked
			const copyBtn = e.target.closest('.copy-btn');
			
			if (copyBtn) {
				// Find the message text associated with that button
				const messageElement = copyBtn.closest('.message-content').querySelector('.message p');
				if (messageElement) {
					const textToCopy = messageElement.innerText;
					
					// Use the modern Navigator Clipboard API
					navigator.clipboard.writeText(textToCopy).then(() => {
						// Provide visual feedback to the user
						const originalIcon = copyBtn.innerHTML;
						copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: green;"></i>';
						
						// Revert the icon back after a short delay
						setTimeout(() => {
							copyBtn.innerHTML = originalIcon;
						}, 1500);
					}).catch(err => {
						console.error('Failed to copy text: ', err);
						alert("Failed to copy text.");
					});
				}
			}
		});
	}
	// The "Apply" button now triggers the log rendering
	if (applyFiltersBtn) {
		applyFiltersBtn.addEventListener('click', renderAuditLogs);
	}
	// The "Export" button now reads the radio button selection
	if (exportLogsBtn) {
		exportLogsBtn.addEventListener('click', () => {
			const selectedFormat = document.querySelector('input[name="export-format"]:checked').value;
			if (selectedFormat) {
				exportLogs(selectedFormat);
			} else {
				alert("אנא בחר פורמט לייצוא.");
			}
		});
	}
	const taknonToggleCheckbox = document.getElementById('taknon-toggle-checkbox');
	// When the user clicks the toggle
	taknonToggleCheckbox.addEventListener('change', async () => {
		const isEnabled = taknonToggleCheckbox.checked;
		try {
			await db.collection('appSettings').doc('global').update({
				isTaknonChatEnabled: isEnabled
			});
			// Update local state and re-render everything
			appSettings.isTaknonChatEnabled = isEnabled;
			renderSidebarMenu();
			populateCategoryDropdown();
			alert(`Chat with Taknon has been ${isEnabled ? 'enabled' : 'disabled'}.`);
		} catch (error) {
			console.error("Error updating Taknon setting:", error);
			alert("Failed to update setting.");
			// Revert the checkbox on failure
			taknonToggleCheckbox.checked = !isEnabled;
		}
	});
	
    // --- PART 7: INITIALIZATION ---
	async function initializeApp() {
		checkAdminMode();
		setAppHeight();

		// 1. Fetch global application settings
		try {
			const settingsDoc = await db.collection('appSettings').doc('global').get();
			if (settingsDoc.exists) {
				appSettings = settingsDoc.data();
			} else {
				console.warn("Global settings document not found.");
			}
		} catch (error) {
			console.error("Error fetching app settings:", error);
		}
		
		// 2. Update the UI toggle to match the fetched setting
		const taknonToggleCheckbox = document.getElementById('taknon-toggle-checkbox');
		if (taknonToggleCheckbox) {
			taknonToggleCheckbox.checked = appSettings.isTaknonChatEnabled;
		}
		
		// 3. Fetch the category data
		await fetchCategories();
		
		// 4. Render all UI components that depend on the data we just fetched
		renderSidebarMenu();
		populateCategoryDropdown();

		// 5. Determine the startup page and default chat
		const isAdmin = window.location.pathname.includes('/admin');
		
		// Find the first VISIBLE chat item to default to
		const firstVisibleChatItem = sidebarMenu.querySelector('li[data-chat-type]:not([style*="display: none"])');

		if (firstVisibleChatItem) {
			// If a chat item is visible, show the chat page and select it
			showPage(chatPage);
			setActiveMenuItem(firstVisibleChatItem);
			switchChat(firstVisibleChatItem.dataset.chatType);
		} else {
			// If NO chat items are visible, show the appropriate "empty state" page
			showPage(emptyStateContainer); 
			setActiveMenuItem(protocolMenuItem);
			
			const emptyAdmin = document.getElementById('empty-state-admin');
			const emptyUser = document.getElementById('empty-state-user');
			if(emptyAdmin && emptyUser) {
				emptyAdmin.style.display = isAdmin ? 'block' : 'none';
				emptyUser.style.display = isAdmin ? 'none' : 'block';
			}
		}
	}
    initializeApp();
});