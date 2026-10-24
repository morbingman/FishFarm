import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCReXGmn4qtfktJZWjJfgdPNWajUFggdoQ",
  authDomain: "fishfarm-6f91e.firebaseapp.com",
  projectId: "fishfarm-6f91e",
  storageBucket: "fishfarm-6f91e.firebasestorage.app",
  messagingSenderId: "404338979691",
  appId: "1:404338979691:web:2646b8f6d7e147f3a0922e",
  measurementId: "G-Y7ZHMRK00P",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
