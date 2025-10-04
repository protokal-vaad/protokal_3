// client/script.js (FINAL, COMPLETE, AND CORRECTLY ORDERED)

document.addEventListener('DOMContentLoaded', () => {
    
    // --- PART 1: VALIDATE FIREBASE CONNECTION ---
    if (typeof firebase === 'undefined' || typeof db === 'undefined') {
        console.error("Firebase has not been initialized correctly. This can be due to an invalid firebaseConfig in firebase-init.js. Aborting script.");
        alert("A critical error occurred while connecting to the database. The application cannot start. Please check the console for details.");
        return; // Stop all further execution
    }

    // --- PART 2: ELEMENT SELECTORS ---
    const addCategoryBtn = document.getElementById('add-category-btn');
	const categoriesList = document.getElementById('categories-list');
	const chatForm = document.getElementById('chat-form');
	const chatPage = document.getElementById('chat-page');
	const chatTaknonBtn = document.querySelector('[data-chat-type="taknon"]');
	const chatTitle = document.getElementById('chat-title');
	const chatWindow = document.getElementById('chat-window');
	const closeMenuBtn = document.getElementById('close-menu');
	const copyHistoryBtn = document.getElementById('copy-history-btn');
	const deleteFilesBtnBottom = document.getElementById('delete-files-btn-bottom');
	const deleteFilesBtnTop = document.getElementById('delete-files-btn-top');
	const emptyStateContainer = document.getElementById('empty-state-container');
	const emptyStateLink = document.getElementById('empty-state-link');
	const existingFilesList = document.getElementById('existing-files-list');
	const fileUploadPage = document.getElementById('file-upload-page');
	const menuFilesBtn = document.getElementById('menu-files');
	const menuToggleBtn = document.getElementById('menu-toggle');
	const messagesContainer = document.getElementById('messages-container');
	const newCategoryNameInput = document.getElementById('new-category-name');
	const protocolMenuItem = document.getElementById('protocol-menu-item');
	const saveOrderBtn = document.getElementById('save-order-btn');
	const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
	const selectAllCheckbox = document.getElementById('select-all-checkbox');
	const sendBtn = document.getElementById('send-btn');
	const settingsMenuBtn = document.getElementById('menu-settings');
	const settingsPage = document.getElementById('settings-page');
	const sidebarMenu = document.getElementById('sidebar-menu');
	const sidebarOverlay = document.getElementById('sidebar-overlay');
	const tabContents = document.querySelectorAll('.tab-content');
	const tabLinks = document.querySelectorAll('.tab-link');
	const uploadActionArea = document.getElementById('upload-action-area');
	const uploadCategorySelect = document.getElementById('upload-category-select');
	const uploadFilesBtn = document.getElementById('upload-files-btn');
	const uploadProgressContainer = document.getElementById('upload-progress-container');
	const userInput = document.getElementById('user-input');
    
    // --- PART 3: FIREBASE REFERENCES ---
    const categoriesCollection = db.collection("categories");
    const uploadedFilesCollection = db.collection("uploadedFiles");
    
    // --- PART 4: APP STATE AND CONFIGURATION ---
    let currentChatType = 'protocol';
    let categories = []; // Central state for all categories
    let sortableInstance = null; // To hold the SortableJS instance
    const chatHistories = { protocol: [], taknon: [] };
    const chatConfig = {
        protocol: { title: "צאט עם פרוטוקול", greeting: "היי! אני פרוטו-קל, העוזר הוירטואלי שלך. איך אפשר לעזור היום?" },
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
        if (isAdminPath) {
            document.getElementById('menu-files').style.display = 'list-item';
            document.getElementById('menu-settings').style.display = 'list-item';
        } else {
            document.getElementById('menu-files').style.display = 'none';
            document.getElementById('menu-settings').style.display = 'none';
        }
    }
    function showPage(pageToShow) {
        // Hide all major page containers first
		if (chatPage) chatPage.style.display = 'none';
		if (settingsPage) settingsPage.style.display = 'none';
		if (fileUploadPage) fileUploadPage.style.display = 'none';
		if (emptyStateContainer) emptyStateContainer.style.display = 'none';

		// Then, show only the one we want
		if (pageToShow) {
			// Use 'flex' for pages that use a flexbox layout, 'block' for simpler pages.
			if (pageToShow === chatPage || pageToShow === emptyStateContainer) {
				pageToShow.style.display = 'flex';
			} else {
				pageToShow.style.display = 'block';
			}
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
             chatHistories[currentChatType].push({ text, sender: senderType });
        }
        const messageElement = createMessageElement(text, senderType);
        if(messagesContainer) messagesContainer.appendChild(messageElement);
        if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
        return messageElement;
    }
    function setAppHeight() {
        const doc = document.documentElement;
        doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    }
    function openSidebar() { document.body.classList.add('sidebar-open'); }
    function closeSidebar() { document.body.classList.remove('sidebar-open'); }
	async function fetchCategories() {
        if (!categoriesCollection) return [];
        try {
            const snapshot = await categoriesCollection.orderBy("order", "asc").get();
            categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.warn("Could not fetch with 'order', trying without. This is normal if categories were created before the 'order' field was added.", error.message);
            try {
                const snapshot = await categoriesCollection.get();
                categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (fallbackError) {
                console.error("Fallback category fetch failed:", fallbackError);
                categories = [];
            }
        }
        return categories;
    }
	function renderSidebarMenu() {
		const protocolSubmenu = document.getElementById('protocol-submenu');
		if (!protocolSubmenu) return;

		protocolSubmenu.innerHTML = ''; // Clear existing dynamic items

		// Add new items from our sorted categories array
		categories.forEach(category => {
			const li = document.createElement('li');
			li.className = 'dynamic-category';
			li.dataset.chatType = category.id;
			li.innerHTML = `<a href="#">${category.name}</a>`;
			protocolSubmenu.appendChild(li);

			if (!chatConfig[category.id]) {
				chatConfig[category.id] = { title: `צאט עם ${category.name}`, greeting: `שאל אותי כל דבר על ${category.name}...` };
			}
		});
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
	async function renderCategories() {
        if (!categoriesList) return;
        categoriesList.innerHTML = '<li>טוען רשימה...</li>';
        await fetchCategories();
        
        if (categories.length === 0) {
            categoriesList.innerHTML = '<li>עדיין לא הוספו קטגוריות.</li>';
            return;
        }
        
        categoriesList.innerHTML = '';
        categories.forEach(category => {
            const li = document.createElement('li');
            li.dataset.id = category.id;
            li.innerHTML = `
                <span><i class="fa-solid fa-grip-vertical" style="cursor: grab; margin-left: 8px; color: #aaa;"></i> ${category.name}</span>
                <button class="delete-btn" data-id="${category.id}" title="מחק קטגוריה">&times;</button>
            `;
            categoriesList.appendChild(li);
        });

        if (sortableInstance) sortableInstance.destroy();
        if (typeof Sortable !== 'undefined') {
            sortableInstance = new Sortable(categoriesList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
            });
        } else {
            console.error("SortableJS is not loaded. Add it to your index.html <head>.");
        }
    }
	async function populateCategoryDropdown() {
		// This function will be called when the upload page is opened
		await fetchCategories(); // Ensure we have the latest categories
		
		uploadCategorySelect.innerHTML = '<option value="" disabled selected>-- בחר קטגוריה --</option>'; // Reset
		
		categories.forEach(category => {
			const option = document.createElement('option');
			option.value = category.id;
			option.textContent = category.name;
			uploadCategorySelect.appendChild(option);
		});
	}
	async function displayExistingFiles(categoryId) {
		const fileListBody = document.getElementById('existing-files-list'); // This is our <tbody>
		fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">טוען קבצים...</td></tr>';
		
		try {
			const querySnapshot = await uploadedFilesCollection
				.where("categoryId", "==", categoryId)
				.orderBy("fileName", "asc")
				.get();

			if (querySnapshot.empty) {
				fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">לא הועלו קבצים לקטגוריה זו.</td></tr>';
				return;
			}

			fileListBody.innerHTML = ''; // Clear the list
			querySnapshot.forEach(doc => {
				const file = { id: doc.id, ...doc.data() };
				const tr = document.createElement('tr');
				const statusText = file.status || 'pending';
				const uploadDate = file.uploadedAt ? 
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
		} catch (error) {
			console.error("Error fetching existing files:", error);
			fileListBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">שגיאה בטעינת קבצים.</td></tr>';
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
					await uploadedFilesCollection.add({
						fileName: fileName,
						categoryId: categoryId,
						gcsPath: filePath, // Full path in Google Cloud Storage
						status: 'pending', // Waiting for the Cloud Function to process it
						uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
					});
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

	// --- PART 6: EVENT LISTENERS ---
	window.addEventListener('resize', setAppHeight);
	if (emptyStateLink) {
		emptyStateLink.addEventListener('click', (e) => {
			e.preventDefault();
			showPage(settingsPage);
			setActiveMenuItem(settingsMenuBtn);
			renderCategories();
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
	
	// if (protocolMenuItem) {
		// const toggleLink = protocolMenuItem.querySelector('.submenu-toggle');
		// toggleLink.addEventListener('click', (e) => {
			// e.preventDefault();
			// // If there are categories, just toggle the menu
			// if (categories.length > 0) {
				// protocolMenuItem.classList.toggle('open');
			// } else {
				// // If there are no categories, re-run the init logic to show the empty state
				// initializeApp();
			// }
		// });
	// }
	// chatTaknonBtn.addEventListener('click', (e) => { e.preventDefault(); setActiveMenuItem(chatTaknonBtn); showPage(chatPage); switchChat('taknon'); });
	// settingsMenuBtn.addEventListener('click', (e) => { e.preventDefault(); setActiveMenuItem(settingsMenuBtn); showPage(settingsPage); renderCategories(); });

	// Settings Page: Tab Listeners
	tabLinks.forEach(link => {
		link.addEventListener('click', () => {
			tabLinks.forEach(l => l.classList.remove('active'));
			link.classList.add('active');
			const tabId = link.dataset.tab;
			tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
            
            // Re-initialize sorting when the categories tab is clicked
            if (tabId === 'categories-tab') {
                renderCategories();
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
				await categoriesCollection.add({ 
					name: categoryName, 
					createdAt: new Date(), 
					order: categories.length
				});
				newCategoryNameInput.value = '';
				await renderCategories(); // Refresh settings list
				renderSidebarMenu(); // Refresh sidebar menu
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
            if (confirm("האם אתה בטוח?")) {
                try {
                    await categoriesCollection.doc(categoryId).delete();
                    await renderCategories(); // Refresh settings list
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
	// userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });
    // if(chatWindow) chatWindow.addEventListener('scroll', () => { const isScrolledToBottom = chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 100; scrollToBottomBtn.classList.toggle('visible', !isScrolledToBottom); });
    // if(scrollToBottomBtn) scrollToBottomBtn.addEventListener('click', () => { chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' }); });
	menuToggleBtn.addEventListener('click', openSidebar);
	closeMenuBtn.addEventListener('click', closeSidebar);
	sidebarOverlay.addEventListener('click', closeSidebar);
	sidebarMenu.addEventListener('click', (e) => {
		const clickedElement = e.target;
		const clickedListItem = clickedElement.closest('li');
		if (!clickedListItem) return;

		// Case 1: The user clicked the main submenu toggle button
		if (clickedElement.closest('.submenu-toggle')) {
			e.preventDefault();
			if (categories.length > 0) {
                protocolMenuItem.classList.toggle('open');
            } else {
                initializeApp();
            }
			return;
		}

		// Case 2: The user clicked a link to a chat (static or dynamic)
		const chatType = clickedListItem.dataset.chatType;
		if (chatType) {
			e.preventDefault();
			setActiveMenuItem(clickedListItem);
			showPage(chatPage);
			switchChat(chatType);
			closeSidebar();
			return;
		}

		// Case 3: The user clicked a link to a non-chat page
		if (clickedListItem.id === 'menu-settings') {
			e.preventDefault();
			setActiveMenuItem(clickedListItem);
			showPage(settingsPage);
			renderCategoriesForSettings(); // Renamed function
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
	});	// Navigation listener for the "העלאת קבצים" menu item
	// menuFilesBtn.addEventListener('click', (e) => {
		// e.preventDefault();
		// setActiveMenuItem(menuFilesBtn);
		// showPage(fileUploadPage);
		// populateCategoryDropdown(); // Populate the dropdown when the page is shown
	// });

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

	// --- NEW: File Deletion and Selection Logic ---
	// function updateDeleteButtonsVisibility() {
		// const checkedBoxes = existingFilesList.querySelectorAll('.file-checkbox:checked');
		// const show = checkedBoxes.length > 0;
		
		// deleteFilesBtnTop.style.display = show ? 'inline-flex' : 'none';
		// deleteFilesBtnBottom.style.display = show ? 'block' : 'none';

		// // Sync the "select all" checkbox state
		// const allCheckboxes = existingFilesList.querySelectorAll('.file-checkbox');
		// selectAllCheckbox.checked = allCheckboxes.length > 0 && checkedBoxes.length === allCheckboxes.length;
		// selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allCheckboxes.length;
	// }

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
			
			console.log("Delete function result:", result.data);
			alert(`${docIdsToDelete.length} קבצים נמחקו בהצלחה.`);

			// Reset UI and refresh the list
			selectAllCheckbox.checked = false;
			const selectedCategoryId = uploadCategorySelect.value;
			await displayExistingFiles(selectedCategoryId);
			updateDeleteButtonsVisibility(); // This will hide the buttons

		} catch (error) {
			console.error("Error calling deleteFiles function:", error);
			alert(`שגיאה במחיקת קבצים: ${error.message}`);
		} finally {
			deleteFilesBtnTop.disabled = false;
			deleteFilesBtnBottom.disabled = false;
			deleteFilesBtnTop.innerHTML = '<i class="fa-solid fa-trash-alt"></i> מחק נבחרים ';
			deleteFilesBtnBottom.innerHTML = '<i class="fa-solid fa-trash-alt"></i> מחק קבצים נבחרים';
		}
	}
	async function getOpenAiStreamingResponse(userText, activeChatType) { 
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
			messageParagraph.classList.remove('thinking-indicator');
			if (fullResponse) {
                if (!chatHistories[activeChatType]) {
                    chatHistories[activeChatType] = [];
                }
				chatHistories[activeChatType].push({ text: fullResponse, sender: 'ai' });
			}
			userInput.disabled = false;
			sendBtn.disabled = false;
			userInput.focus();
		}
	}
	deleteFilesBtnTop.addEventListener('click', handleFileDeletion);
	deleteFilesBtnBottom.addEventListener('click', handleFileDeletion);
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
	
    // --- PART 7: INITIALIZATION ---
	async function initializeApp() {
		checkAdminMode();
		setAppHeight();
		await fetchCategories();
		renderSidebarMenu();

		const isAdmin = window.location.pathname.includes('/admin');

		if (categories.length > 0) {
			// If categories exist, show the chat page and select the first category.
			showPage(chatPage);
			const firstCategoryItem = sidebarMenu.querySelector('#protocol-submenu li');
			setActiveMenuItem(firstCategoryItem);
			switchChat(firstCategoryItem.dataset.chatType);
		} else {
			// NO CATEGORIES EXIST.
			// Show the empty state page instead of the chat page.
			showPage(emptyStateContainer); 
			setActiveMenuItem(protocolMenuItem); // Highlight the main protocol menu

			// Show the correct message inside the empty state page.
			const emptyAdmin = document.getElementById('empty-state-admin');
			const emptyUser = document.getElementById('empty-state-user');
			if (isAdmin) {
				emptyUser.style.display = 'none';
				emptyAdmin.style.display = 'block';
			} else {
				emptyAdmin.style.display = 'none';
				emptyUser.style.display = 'block';
			}
		}
	}

    initializeApp();
});