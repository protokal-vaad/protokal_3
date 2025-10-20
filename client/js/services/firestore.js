// js/services/firestore.js

// Import the database service from our central Firebase initialization
//import { db } from '../firebase.js';

// --- DEFINE COLLECTION REFERENCES ---
// These are now local to this module.
const categoriesCollection = db.collection("categories");
const uploadedFilesCollection = db.collection("uploadedFiles");
const auditLogsCollection = db.collection("auditLogs");

// Note: This module relies on the global 'db' variable initialized in firebase-init.js
if (typeof db === 'undefined') {
    console.error("Firestore 'db' is not defined. This module will not work.");
}

export async function fetchCategories() {
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
let allUploadedFiles = [];
export async function fetchAllFilesForViewer() {
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
export async function logAuditEvent(action, description, details = {}) {
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
export async function renderAuditLogs() {
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
export async function exportLogs(format = 'json') {
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
export async function isUsernameTaken(username, currentUserId = null) {
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


// ... You would also move other Firestore functions here, like fetchUsers(), etc.