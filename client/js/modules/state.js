    // --- PART 4: APP STATE & CONFIG ---
	export let appSettings = { isTaknonChatEnabled: false };
    export let currentChatType = 'protocol';
	export let allCategories = []; // A single, unified list for ALL categories
	export let sortableInstance = null;
	export const chatHistories = {}; // Start empty, will be populated dynamically
	export const chatConfig = {
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
    
	export let currentSort = { field: "fileName", direction: "asc" }; // Default sort