// client/script.js (FINAL, COMPLETE, AND CORRECTLY ORDERED)

document.addEventListener('DOMContentLoaded', () => {
    
    // --- PART 1: VALIDATE FIREBASE ---
    if (typeof firebase === 'undefined' || typeof db === 'undefined' || typeof storage === 'undefined' || typeof firebase.functions === 'undefined') {
        console.error("Firebase services are not initialized correctly. Check script load order in index.html.");
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
	const docViewerPage = document.getElementById('doc-viewer-page');
    const menuDocViewerBtn = document.getElementById('menu-doc-viewer');
    const docViewerYearSelect = document.getElementById('doc-viewer-year-select');
    const docViewerDocSelect = document.getElementById('doc-viewer-doc-select');
    const docViewerContent = document.getElementById('doc-viewer-content');
	const docViewerCategorySelect = document.getElementById('doc-viewer-category-select');
	// --- NEW: User Management Elements ---
    const usersListBody = document.getElementById('users-list');
    const selectAllUsersCheckbox = document.getElementById('select-all-users-checkbox');
    const addUserBtn = document.getElementById('add-user-btn');
    const editUserBtn = document.getElementById('edit-user-btn');
    const deleteUsersBtn = document.getElementById('delete-users-btn');
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    const userFormModal = document.getElementById('user-form-modal');
    const userForm = document.getElementById('user-form');
    const userFormTitle = document.getElementById('user-form-title');
    const userFormError = document.getElementById('user-form-error');
    const userModalCloseBtn = document.getElementById('user-modal-close-btn');
	const importExportContainer = document.getElementById('import-export-container');
    const importExportBtn = document.getElementById('import-export-btn');
    const importExportMenu = document.getElementById('import-export-menu');
    const userIdInput = document.getElementById('user-id');
	const userSearchInput = document.getElementById('user-search-input');
	const fileSearchInput = document.getElementById('file-search-input');
	const userCountSpan = document.getElementById('user-count');
    
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
		// New, more welcoming message for the "general" chat
		protocol: { 
			title: "צאט עם פרוטוקול כללי", 
			greeting: "שלום! 👋 אני <strong>פרוטו-קל</strong>. ניתן לשאול אותי שאלות כלליות, או לבחור קטגוריה ספציפית מהתפריט כדי להתמקד בנושא מסוים." 
		},
		// New, more welcoming message for the Taknon
		taknon: { 
			title: "צאט עם התקנון", 
			greeting: "ברוכים הבאים לצ'אט התקנון! ⚖️ שאלו אותי כל דבר על נהלים, חוקים וכל מה שביניהם." 
		}
	};
    
	let currentSort = { field: "fileName", direction: "asc" }; // Default sort
	
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
		if (docViewerPage) docViewerPage.style.display = 'none';

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
			if (!chatConfig[category.id]) {
				chatConfig[category.id] = { 
					title: `צאט עם ${category.name}`, 
					greeting: `מחפש מידע מתוך פרוטוקול? שאל אותי כל דבר מתוך מאגר <strong>${category.name}</strong>. 📂 מה תרצו לדעת?` 
				};
			}
		});
		
		// Control Taknon visibility with the feature flag
		taknonMenuItem.style.display = appSettings.isTaknonChatEnabled ? 'list-item' : 'none';
	}
	async function populateAllCategories(selectElement) {
		if (!selectElement) {
			console.error("--- DEBUG: populateAllCategories FAILED. Reason: 'selectElement' was not provided.");
			return;
		}
		
		selectElement.innerHTML = '<option value="" disabled selected>-- בחר קטגוריה --</option>';
		
		console.log(`--- DEBUG: Starting populateAllCategories for element: #${selectElement.id} ---`);
		console.log(`Current appSettings.isTaknonChatEnabled: ${appSettings.isTaknonChatEnabled}`);

		try {
			console.log("Fetching ALL categories from Firestore for dropdown...");
			const snapshot = await categoriesCollection.orderBy("order", "asc").get();

			if (snapshot.empty) {
				console.warn("DEBUG: Firestore query returned NO categories.");
				return;
			}

			console.log(`DEBUG: Firestore query returned ${snapshot.size} categories.`);

			snapshot.forEach(doc => {
				const category = { id: doc.id, ...doc.data() };
				console.log(`  > Processing category: ID=${category.id}, Name=${category.name}`);

				if (category.id === 'taknon' && !appSettings.isTaknonChatEnabled) {
					console.log("    -> SKIPPING 'taknon' because its feature flag is disabled.");
					return;
				}

				console.log(`    -> ADDING '${category.name}' to dropdown #${selectElement.id}.`);
				const option = document.createElement('option');
				option.value = category.id;
				option.textContent = category.name;
				selectElement.appendChild(option);
			});

		} catch (error) {
			console.error("--- DEBUG: ERROR occurred in populateAllCategories ---", error);
		}
		console.log(`--- DEBUG: Finished populateAllCategories for #${selectElement.id} ---`);
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
		const fileCountSpan = document.getElementById('file-count'); // Get the new counter element
		if (!fileListBody || !fileCountSpan) return;

		fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">טוען קבצים...</td></tr>';
		fileCountSpan.textContent = ''; // Clear the count while loading

		try {
			// We remove the .orderBy() here because we will perform a more flexible sort on the client-side.
			const querySnapshot = await uploadedFilesCollection
				.where("categoryId", "==", categoryId)
				.get();

			if (querySnapshot.empty) {
				fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">לא הועלו קבצים לקטגוריה זו.</td></tr>';
				fileCountSpan.textContent = '(0)'; // Update counter for empty state
				return;
			}

			// --- NEW: Client-Side Sorting Logic ---
			let files = [];
			querySnapshot.forEach(doc => files.push({ id: doc.id, ...doc.data() }));
			
			const searchTerm = fileSearchInput.value.trim().toLowerCase();
			if (searchTerm) {
				files = files.filter(file => 
					file.fileName.toLowerCase().includes(searchTerm)
				);
			}
			
			if (files.length === 0) {
				const message = searchTerm ? 'לא נמצאו קבצים תואמים לחיפוש.' : 'לא הועלו קבצים לקטגוריה זו.';
				fileListBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">${message}</td></tr>`;
				fileCountSpan.textContent = '(0)';
				return;
			}

			// Sort the array of files based on the global 'currentSort' state variable
			files.sort((a, b) => {
				// Get the values to compare, providing fallbacks for missing data
				const valA = a[currentSort.field] || '';
				const valB = b[currentSort.field] || '';

				let comparison = 0;
				// Special sorting for dates
				if (currentSort.field === 'uploadedAt') {
					const timeA = valA.seconds || 0;
					const timeB = valB.seconds || 0;
					comparison = timeA - timeB;
				} else {
					// Standard alphabetical sorting for text fields
					comparison = valA.toString().localeCompare(valB.toString(), 'he');
				}
				
				// Apply sort direction (asc or desc)
				return currentSort.direction === 'asc' ? comparison : -comparison;
			});
			// --- END OF NEW SORTING LOGIC ---

			fileListBody.innerHTML = ''; // Clear the list
			
			// Render the newly sorted 'files' array
			files.forEach(file => {
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

			// --- NEW: Update the file counter ---
			fileCountSpan.textContent = `(${files.length})`;

		} catch (error) {
			console.error("Error fetching existing files:", error);
			fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">שגיאה בטעינת קבצים.</td></tr>';
		} finally {
			// Your existing logic here is correct
			updateDeleteButtonsVisibility();
			// Add the call to update the sort icons in the header
			updateSortHeadersUI();
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
					const category = allCategories.find(c => c.id === categoryId);
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
		populateAllCategories(uploadCategorySelect);
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
	// This global array will cache the file list so we don't have to re-fetch it constantly
	let allUploadedFiles = [];
	async function fetchAllFilesForViewer() {
		console.log("Fetching all uploaded files for viewer...");
		try {
			const snapshot = await uploadedFilesCollection.orderBy("uploadedAt", "desc").get();
			allUploadedFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			console.log(`Found ${allUploadedFiles.length} total files.`);
		} catch (error) {
			console.error("Error fetching all files:", error);
			allUploadedFiles = [];
		}
	}
	function populateYearFilter(selectedCategoryId) {
		docViewerYearSelect.innerHTML = '<option value="" disabled selected>-- בחר שנה --</option>';
		docViewerYearSelect.disabled = true;

		if (!selectedCategoryId) return;

		const years = new Set();
		// Filter the global file list for the selected category first
		allUploadedFiles
			.filter(file => file.categoryId === selectedCategoryId)
			.forEach(file => {
				if (file.documentDate?.seconds) {
					years.add(new Date(file.documentDate.seconds * 1000).getFullYear());
				}
			});

		if (years.size > 0) {
			// 1. Convert the Set to an array of numbers.
			const sortedYears = Array.from(years);
			// 2. Sort the array in descending order (newest to oldest).
			sortedYears.sort((a, b) => b - a);
			// 3. Populate the dropdown with the sorted array.
			sortedYears.forEach(year => {
				const option = document.createElement('option');
				option.value = year;
				option.textContent = year;
				docViewerYearSelect.appendChild(option);
			});
			docViewerYearSelect.disabled = false; // Enable the dropdown
		} else {
			docViewerYearSelect.innerHTML = '<option value="" disabled selected>-- אין קבצים בקטגוריה זו --</option>';
		}
	}
	function populateDocFilter(selectedCategoryId, selectedYear) {
		docViewerDocSelect.innerHTML = '<option value="" disabled selected>-- בחר מסמך --</option>';
		docViewerDocSelect.disabled = true;

		if (!selectedCategoryId || !selectedYear) return;

		const filesForYear = allUploadedFiles.filter(file => {
			if (!file.documentDate?.seconds) return false;
			const fileYear = new Date(file.documentDate.seconds * 1000).getFullYear();
			// Filter by BOTH category and year
			return file.categoryId === selectedCategoryId && fileYear == selectedYear;
		});

		if (filesForYear.length > 0) {
			filesForYear.forEach(file => {
				const option = document.createElement('option');
				option.value = file.gcsPath;
				option.textContent = file.fileName;
				docViewerDocSelect.appendChild(option);
			});
			docViewerDocSelect.disabled = false; // Enable the dropdown
		} else {
			docViewerDocSelect.innerHTML = '<option value="" disabled selected>-- אין מסמכים בשנה זו --</option>';
		}
	}
	// --- NEW: User Management Functions ---
	// Checks if a username contains only English letters and numbers
	function isValidUsername(username) {
		// This regex matches a string that contains one or more characters
		// that are exclusively a-z, A-Z, or 0-9.
		const regex = /^[a-zA-Z0-9]+$/;
		return regex.test(username);
	}
	// Checks if a phone number contains only digits (and optional dashes)
	function isValidPhone(phone) {
		// This regex first removes any dashes, then checks if the remaining
		// string consists only of digits.
		const regex = /^[0-9]+$/;
		return regex.test(phone.replace(/-/g, ''));
	}
	// Checks the Firestore database to see if a username already exists
	async function isUsernameTaken(username, currentUserId = null) {
		if (!username) return false;
		
		// Create a query to find any user with the same username
		const query = db.collection('users').where('username', '==', username);
		
		try {
			const snapshot = await query.get();
			
			if (snapshot.empty) {
				// No user found with this username, so it's available.
				return false;
			}

			// If we are EDITING a user, we need to make sure the found username
			// doesn't belong to the user we are currently editing.
			if (currentUserId) {
				// Check if any of the found documents have a DIFFERENT ID
				// than the one we are editing.
				for (const doc of snapshot.docs) {
					if (doc.id !== currentUserId) {
						return true; // Found a different user with this username
					}
				}
				return false; // The only match was the user themselves
			}
			
			// If we are ADDING a new user, any match means the username is taken.
			return true;
			
		} catch (error) {
			console.error("Error checking username uniqueness:", error);
			// In case of an error, we should prevent the save to be safe.
			return true;
		}
	}
	// Renders the table of users from Firestore
	async function renderUsersTable() {
		if (!usersListBody) return;
		usersListBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">טוען רשימת משתמשים...</td></tr>';
		if (userCountSpan) userCountSpan.textContent = '';

		const searchTerm = userSearchInput.value.trim().toLowerCase();

		try {
			let users = [];

			if (searchTerm) {
				// --- NEW: Multi-Query Search Logic ---
				console.log(`Searching for users where first or last name starts with: "${searchTerm}"`);

				// Firestore "starts with" query trick: >= search term and < search term + high unicode character
				const endTerm = searchTerm + '\uf8ff';

				// Query 1: Search by firstName
				const firstNameQuery = db.collection("users")
					.where('firstName', '>=', searchTerm)
					.where('firstName', '<', endTerm);
				
				// Query 2: Search by lastName
				const lastNameQuery = db.collection("users")
					.where('lastName', '>=', searchTerm)
					.where('lastName', '<', endTerm);

				const [firstNameResults, lastNameResults] = await Promise.all([
					firstNameQuery.get(),
					lastNameQuery.get()
				]);

				// Combine and de-duplicate the results
				const usersMap = new Map();
				firstNameResults.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() }));
				lastNameResults.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() }));
				
				users = Array.from(usersMap.values());
				
				// Sort the combined results client-side
				users.sort((a, b) => a.lastName.localeCompare(b.lastName, 'he'));

			} else {
				// --- Original Logic: Fetch all users ---
				const snapshot = await db.collection("users").orderBy("lastName", "asc").get();
				users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			}
			
			if (userCountSpan) {
				userCountSpan.textContent = `סה"כ: ${users.length}`;
			}

			if (users.length === 0) {
				usersListBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">${searchTerm ? 'לא נמצאו משתמשים תואמים.' : 'לא נמצאו משתמשים.'}</td></tr>`;
				return;
			}

			usersListBody.innerHTML = '';
			users.forEach(user => {
				const tr = document.createElement('tr');
				// ... (The tr.innerHTML part is the same as before) ...
				tr.innerHTML = `
					<td class="col-check"><input type="checkbox" class="user-checkbox" data-user-id="${user.id}"></td>
					<td class="col-last-name">${user.lastName || ''}</td>
					<td class="col-first-name">${user.firstName || ''}</td>
					<td class="col-phone">${user.phone || ''}</td>
					<td class="col-email">${user.email || ''}</td>
					<td class="col-username">${user.username || ''}</td>
				`;
				usersListBody.appendChild(tr);
			});

		} catch (error) {
			console.error("Error fetching users:", error);
			usersListBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">שגיאה בטעינת המשתמשים.</td></tr>';
		}
	}	// Enables/disables toolbar buttons based on selection
	function updateUserToolbarState() {
		const checkedBoxes = usersListBody.querySelectorAll('.user-checkbox:checked');
		
		editUserBtn.disabled = checkedBoxes.length !== 1;
		resetPasswordBtn.disabled = checkedBoxes.length !== 1;
		deleteUsersBtn.disabled = checkedBoxes.length === 0;

		const allCheckboxes = usersListBody.querySelectorAll('.user-checkbox');
		selectAllUsersCheckbox.checked = allCheckboxes.length > 0 && checkedBoxes.length === allCheckboxes.length;
	}
	// Opens the Add/Edit modal
	function openUserModal(mode = 'add', userData = null) {
		userForm.reset();
		userFormError.textContent = '';
		userIdInput.value = '';

		if (mode === 'edit' && userData) {
			userFormTitle.textContent = 'ערוך משתמש';
			userIdInput.value = userData.id;
			document.getElementById('user-firstName').value = userData.firstName || '';
			document.getElementById('user-lastName').value = userData.lastName || '';
			document.getElementById('user-phone').value = userData.phone || '';
			document.getElementById('user-email').value = userData.email || '';
			document.getElementById('user-username').value = userData.username || '';
		} else {
			userFormTitle.textContent = 'הוסף משתמש חדש';
		}
		
		userFormModal.style.display = 'flex';
	}
	// Closes the Add/Edit modal
	function closeUserModal() {
		userFormModal.style.display = 'none';
	}
	// --- NEW: User Import/Export Functions ---
	async function exportUsers(format = 'json') {
		console.log(`Exporting users as ${format}...`);
		try {
			const snapshot = await db.collection("users").orderBy("lastName", "asc").get();
			if (snapshot.empty) {
				alert("לא נמצאו משתמשים לייצוא.");
				return;
			}

			const users = snapshot.docs.map(doc => {
				const data = doc.data();
				// Select and order the fields for a clean export
				return {
					lastName: data.lastName,
					firstName: data.firstName,
					phone: data.phone,
					email: data.email,
					username: data.username,
					role: data.role
				};
			});

			const now = new Date();
			const date = now.toLocaleDateString('en-GB').split('/').join('-');
			const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
			const fileName = `users_${date}_${time}`;
			
			logAuditEvent('USERS_EXPORTED', `יוצאו ${users.length} משתמשים כ-${format.toUpperCase()}`, { count: users.length, format });

			if (format === 'json') {
				downloadFile(JSON.stringify(users, null, 2), `${fileName}.json`, 'application/json');
			} else if (format === 'csv') {
				const csvString = Papa.unparse(users); // Use PapaParse to easily create a CSV
				downloadFile(csvString, `${fileName}.csv`, 'text/csv;charset=utf-8;');
			}
		} catch (error) {
			console.error("Error exporting users:", error);
			alert("שגיאה בייצוא המשתמשים.");
		}
	}
	async function handleImportedUsers(users) {
		const requiredFields = ['lastName', 'firstName', 'phone', 'email', 'username'];
		
		// --- Basic Validation ---
		if (!users || users.length === 0) {
			alert("קובץ ריק או לא תקין.");
			return;
		}
		const firstUser = users[0];
		if (!firstUser || !requiredFields.every(field => field in firstUser)) {
			alert("קובץ לא תקין. יש לוודא שהקובץ מכיל את העמודות הנדרשות: " + requiredFields.join(', '));
			return;
		}

		if (!confirm(`נמצאו ${users.length} משתמשים בקובץ. האם ברצונך להתחיל בתהליך היבוא והאימות?`)) return;

		console.log("Starting import validation...");

		// --- NEW: Uniqueness Validation Step ---
		try {
			// 1. Fetch all existing usernames from Firestore into a Set for fast lookups.
			console.log("Fetching existing usernames from database...");
			const existingUsernames = new Set();
			const snapshot = await db.collection("users").get();
			snapshot.forEach(doc => {
				const username = doc.data().username;
				if (username) {
					existingUsernames.add(username.toLowerCase());
				}
			});
			console.log(`Found ${existingUsernames.size} existing usernames.`);

			// 2. Check for duplicates within the file and against the database.
			const usernamesInFile = new Set();
			const duplicateUsernames = [];

			for (let i = 0; i < users.length; i++) {
				const user = users[i];
				const username = user.username ? user.username.toLowerCase() : '';

				if (!username) {
					alert(`שגיאה בשורה ${i + 2}: שם המשתמש חסר.`);
					return;
				}

				// Check if username already exists in the database
				if (existingUsernames.has(username)) {
					duplicateUsernames.push(username);
				}
				
				// Check if username is a duplicate within the file itself
				if (usernamesInFile.has(username)) {
					duplicateUsernames.push(username);
				}
				usernamesInFile.add(username);
			}

			// 3. If any duplicates are found, abort the entire operation.
			if (duplicateUsernames.length > 0) {
				// Use a Set to show only unique duplicate names in the error
				const uniqueDuplicates = [...new Set(duplicateUsernames)];
				alert(`היבוא בוטל. נמצאו שמות משתמש כפולים:\n\n${uniqueDuplicates.join(', ')}\n\nאנא תקן את הקובץ ונסה שוב.`);
				return;
			}

			console.log("Validation successful. No duplicates found. Proceeding with import.");
			
			// --- End of Uniqueness Validation ---


			// If validation passes, proceed with the batch write.
			const batch = db.batch();
			users.forEach(user => {
				const newUserRef = db.collection("users").doc();
				batch.set(newUserRef, {
					firstName: user.firstName || '',
					lastName: user.lastName || '',
					phone: user.phone || '',
					email: user.email || '',
					username: user.username, // We know it exists from validation
					role: 'member',
					createdAt: firebase.firestore.FieldValue.serverTimestamp()
				});
			});

			await batch.commit();
			logAuditEvent('USERS_IMPORTED', `יובאו ${users.length} משתמשים חדשים`, { count: users.length });
			alert(`${users.length} משתמשים יובאו בהצלחה!`);
			await renderUsersTable();

		} catch (error) {
			console.error("Error during user import validation or commit:", error);
			alert("אירעה שגיאה קריטית במהלך היבוא. אנא בדוק את הקונסול.");
		}
	}
	function updateSortHeadersUI() {
		const allHeaders = document.querySelectorAll('#existing-files-table th.sortable');
		allHeaders.forEach(th => {
			th.classList.remove('sorted-asc', 'sorted-desc');
			const sortIcon = th.querySelector('.sort-icon');
			sortIcon.className = 'sort-icon fa-solid fa-sort'; // Reset icon

			if (th.dataset.sort === currentSort.field) {
				if (currentSort.direction === 'asc') {
					th.classList.add('sorted-asc');
					sortIcon.className = 'sort-icon fa-solid fa-sort-up';
				} else {
					th.classList.add('sorted-desc');
					sortIcon.className = 'sort-icon fa-solid fa-sort-down';
				}
			}
		});
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
	sidebarMenu.addEventListener('click', async (e) => {
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
		if (clickedListItem.id === 'menu-doc-viewer') {
			e.preventDefault();
			setActiveMenuItem(clickedListItem);
			showPage(docViewerPage);
			await fetchAllFilesForViewer();
			await populateAllCategories(docViewerCategorySelect);
			
			// Reset the subsequent dropdowns
			docViewerYearSelect.innerHTML = '<option value="" disabled selected>-- בחר שנה --</option>';
			docViewerYearSelect.disabled = true;
			docViewerDocSelect.innerHTML = '<option value="" disabled selected>-- בחר מסמך --</option>';
			docViewerDocSelect.disabled = true;
			docViewerContent.innerHTML = '<p>אנא בחר קטגוריה, שנה ומסמך לצפייה.</p>';
			
			closeSidebar();
			return;
		}
	});
	// Listener for when the admin selects a category
	uploadCategorySelect.addEventListener('change', () => {
		const selectedCategoryId = uploadCategorySelect.value;
		if (selectedCategoryId) {
			fileSearchInput.value = '';
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
			populateAllCategories();
			alert(`Chat with Taknon has been ${isEnabled ? 'enabled' : 'disabled'}.`);
		} catch (error) {
			console.error("Error updating Taknon setting:", error);
			alert("Failed to update setting.");
			// Revert the checkbox on failure
			taknonToggleCheckbox.checked = !isEnabled;
		}
	});
    if (docViewerCategorySelect) {
        docViewerCategorySelect.addEventListener('change', () => {
            const selectedCategoryId = docViewerCategorySelect.value;
            populateYearFilter(selectedCategoryId); // This function needs to be added
            docViewerDocSelect.innerHTML = '<option value="" disabled selected>-- בחר מסמך --</option>';
            docViewerDocSelect.disabled = true;
            docViewerContent.innerHTML = '<p>אנא בחר שנה ומסמך לצפייה.</p>';
        });
    }
    if (docViewerYearSelect) {
        docViewerYearSelect.addEventListener('change', () => {
            const selectedCategoryId = docViewerCategorySelect.value;
            const selectedYear = docViewerYearSelect.value;
            populateDocFilter(selectedCategoryId, selectedYear); // This function needs to be added
            docViewerContent.innerHTML = '<p>אנא בחר מסמך לצפייה.</p>';
        });
    }
	if (docViewerDocSelect) {
		docViewerDocSelect.addEventListener('change', async () => {
			const gcsPath = docViewerDocSelect.value;
			if (!gcsPath) return;

			docViewerContent.innerHTML = '<p>טוען מסמך...</p>';

			try {
				// Get a public download URL for the file from Cloud Storage
				const fileRef = storage.ref(gcsPath);
				const downloadUrl = await fileRef.getDownloadURL();

				// Embed the document in an iframe. Use Google's viewer for cross-compatibility.
				docViewerContent.innerHTML = `
					<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(downloadUrl)}&embedded=true"></iframe>
				`;
			} catch (error) {
				console.error("Error getting download URL:", error);
				docViewerContent.innerHTML = '<p>שגיאה בטעינת המסמך.</p>';
			}
		});
	}
    // --- NEW: User Management Event Listeners ---
    // When the Users tab is clicked, render the table
    const usersTabLink = document.querySelector('.tab-link[data-tab="users-tab"]');
    if (usersTabLink) {
        usersTabLink.addEventListener('click', renderUsersTable);
    }
    
    // Use event delegation for checkboxes in the table body
    if (usersListBody) {
        usersListBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('user-checkbox')) {
                updateUserToolbarState();
            }
        });
    }

    // Select All checkbox
    if (selectAllUsersCheckbox) {
        selectAllUsersCheckbox.addEventListener('change', () => {
            usersListBody.querySelectorAll('.user-checkbox').forEach(cb => {
                cb.checked = selectAllUsersCheckbox.checked;
            });
            updateUserToolbarState();
        });
    }

    // Toolbar Buttons
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserModal('add'));
    }

    if (editUserBtn) {
        editUserBtn.addEventListener('click', async () => {
            const selectedId = usersListBody.querySelector('.user-checkbox:checked').dataset.userId;
            try {
                const userDoc = await db.collection('users').doc(selectedId).get();
                if (userDoc.exists) {
                    openUserModal('edit', { id: userDoc.id, ...userDoc.data() });
                }
            } catch (error) {
                console.error("Error fetching user for edit:", error);
            }
        });
    }

    if (deleteUsersBtn) {
        deleteUsersBtn.addEventListener('click', async () => {
            const checkedBoxes = usersListBody.querySelectorAll('.user-checkbox:checked');
            if (checkedBoxes.length === 0) return;

            if (confirm(`האם אתה בטוח שברצונך למחוק ${checkedBoxes.length} משתמשים?`)) {
                const batch = db.batch();
                const deletedUsers = [];
                checkedBoxes.forEach(cb => {
                    const docId = cb.dataset.userId;
                    batch.delete(db.collection('users').doc(docId));
                    deletedUsers.push(docId);
                });
                
                try {
                    await batch.commit();
                    logAuditEvent('USERS_DELETED', `${deletedUsers.length} משתמשים נמחקו`, { count: deletedUsers.length, userIds: deletedUsers });
                    alert(`${deletedUsers.length} משתמשים נמחקו בהצלחה.`);
                    await renderUsersTable();
                    updateUserToolbarState();
                } catch (error) {
                    console.error("Error deleting users:", error);
                    alert("שגיאה במחיקת משתמשים.");
                }
            }
        });
    }

    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', () => {
            const selectedCheckbox = usersListBody.querySelector('.user-checkbox:checked');
            const userEmail = selectedCheckbox.closest('tr').querySelector('.col-email').textContent;
            
            if (confirm(`האם לאפס סיסמה עבור ${userEmail}?`)) {
                // Placeholder logic for now
                logAuditEvent('PASSWORD_RESET', `איפוס סיסמה עבור ${userEmail}`, { email: userEmail });
                alert("פונקציונליות איפוס סיסמה תחובר עם מערכת ההתחברות בעתיד.");
            }
        });
    }

    // Modal Form Listeners
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userData = {
                firstName: document.getElementById('user-firstName').value,
                lastName: document.getElementById('user-lastName').value,
                phone: document.getElementById('user-phone').value,
                email: document.getElementById('user-email').value,
                username: document.getElementById('user-username').value,
            };
            const userId = userIdInput.value;
			
			if (!isValidUsername(userData.username)) {
                userFormError.textContent = "שם המשתמש יכול להכיל אותיות באנגלית ומספרים בלבד.";
                return; // Stop the submission
            }
            if (!isValidPhone(userData.phone)) {
                userFormError.textContent = "מספר הטלפון יכול להכיל ספרות בלבד.";
                return; // Stop the submission
            }
            if (await isUsernameTaken(userData.username, userId)) {
                userFormError.textContent = "שם המשתמש שהזנת כבר קיים במערכת.";
                return; // Stop the submission
            }

            try {
                if (userId) {
                    // Editing existing user
                    await db.collection('users').doc(userId).update(userData);
                    logAuditEvent('USER_UPDATED', `המשתמש '${userData.email}' עודכן`, { userId, ...userData });
                    alert("המשתמש עודכן בהצלחה.");
                } else {
                    // Creating new user
                    userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    userData.role = 'member'; // Default role
                    const docRef = await db.collection('users').add(userData);
                    logAuditEvent('USER_CREATED', `המשתמש '${userData.email}' נוצר`, { userId: docRef.id, ...userData });
                    alert("המשתמש נוצר בהצלחה.");
                }
                closeUserModal();
                await renderUsersTable();
                updateUserToolbarState();
            } catch (error) {
                console.error("Error saving user:", error);
                userFormError.textContent = "שגיאה בשמירת המשתמש.";
            }
        });
    }

    if (userModalCloseBtn) {
        userModalCloseBtn.addEventListener('click', closeUserModal);
    }
	// --- NEW: Import/Export Listeners ---
    // Logic to open/close the dropdown menu
    if (importExportBtn) {
        importExportBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the window click from closing it immediately
            importExportContainer.classList.toggle('open');
        });
    }
    // Close the dropdown if the user clicks outside of it
    window.addEventListener('click', () => {
        if (importExportContainer.classList.contains('open')) {
            importExportContainer.classList.remove('open');
        }
    });
    // Add listeners for each menu item
    if (importExportMenu) {
        importExportMenu.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = e.target.id;

            if (targetId === 'export-csv-btn') {
                exportUsers('csv');
            }
            if (targetId === 'export-json-btn') {
                exportUsers('json');
            }
            if (targetId === 'import-csv-btn' || targetId === 'import-json-btn') {
                // Create a temporary file input to open the file dialog
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = targetId === 'import-csv-btn' ? '.csv' : '.json';
                
                fileInput.onchange = (event) => {
                    const file = event.target.files[0];
                    if (!file) return;

                    if (targetId === 'import-json-btn') {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            try {
                                const users = JSON.parse(e.target.result);
                                if (Array.isArray(users)) {
                                    handleImportedUsers(users);
                                } else {
                                    alert("קובץ JSON לא תקין. הקובץ חייב להכיל מערך של משתמשים.");
                                }
                            } catch (jsonError) {
                                alert("שגיאה בפענוח קובץ ה-JSON.");
                            }
                        };
                        reader.readAsText(file);
                    } else { // CSV
                        Papa.parse(file, {
                            header: true,
                            skipEmptyLines: true,
                            complete: (results) => {
                                handleImportedUsers(results.data);
                            },
                            error: (err) => {
                                alert(`שגיאה בפענוח קובץ ה-CSV: ${err.message}`);
                            }
                        });
                    }
                };
                fileInput.click();
            }
            // Close the menu after action
            importExportContainer.classList.remove('open');
        });
    }
	if (userSearchInput) {
		// We use 'keyup' to trigger the search as the user types
		userSearchInput.addEventListener('keyup', (e) => {
			// A small delay (debounce) to prevent a query on every single keystroke
			clearTimeout(userSearchInput.timer);
			userSearchInput.timer = setTimeout(() => {
				renderUsersTable();
			}, 300); // Wait 300ms after the user stops typing
		});
	}
	const fileListHeader = document.querySelector('#existing-files-table thead');
	if (fileListHeader) {
		fileListHeader.addEventListener('click', (e) => {
			const header = e.target.closest('th.sortable');
			if (!header) return;

			const sortField = header.dataset.sort;

			// Toggle direction if clicking the same field, otherwise default to ascending
			if (currentSort.field === sortField) {
				currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
			} else {
				currentSort.field = sortField;
				currentSort.direction = 'asc';
			}
			
			// Re-render the file list with the new sort order
			const selectedCategoryId = uploadCategorySelect.value;
			if (selectedCategoryId) {
				displayExistingFiles(selectedCategoryId);
			}
		});
	}
	if (fileSearchInput) {
		// We use 'keyup' to trigger the search as the user types
		fileSearchInput.addEventListener('keyup', () => {
			// A small delay (debounce) to prevent a re-render on every single keystroke
			clearTimeout(fileSearchInput.timer);
			fileSearchInput.timer = setTimeout(() => {
				const selectedCategoryId = uploadCategorySelect.value;
				if (selectedCategoryId) {
					displayExistingFiles(selectedCategoryId);
				}
			}, 300); // Wait 300ms after the user stops typing
		});
	}
	
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
		//populateAllCategories();

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
		if (document.querySelector('#users-tab.active')) {
			renderUsersTable();
		}
	}
    initializeApp();
});