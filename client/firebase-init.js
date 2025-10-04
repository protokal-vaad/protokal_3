// client/firebase-init.js (This should be correct)

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBS5I6wP4d6_M4vcAp_nEX85EKREANam30",
  authDomain: "protokal-v3.firebaseapp.com",
  projectId: "protokal-v3",
  storageBucket: "protokal-v3.firebasestorage.app",
  messagingSenderId: "182876148728",
  appId: "1:182876148728:web:1ca6764b3c0cb5b485bc0d",
  measurementId: "G-YBBNL8F65W"
};

// Initialize Firebase and create global variables
let auth;
let db;

try {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully.");
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();
} catch (e) {
  console.error("CRITICAL: Firebase initialization failed.", e);
  alert("FATAL ERROR: Could not connect to Firebase. See console for details.");
}