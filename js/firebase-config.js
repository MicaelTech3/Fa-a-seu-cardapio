// firebase-config.js
// Configuração do Firebase Web SDK v9 (Modular)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';

// Configuração do Firebase fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyDEneDt3pzeq2tXbU5unBiG63R9pHHFUK4",
  authDomain: "cardapio-excd.firebaseapp.com",
  projectId: "cardapio-excd",
  storageBucket: "cardapio-excd.firebasestorage.app",
  messagingSenderId: "622683922763",
  appId: "1:622683922763:web:ab392a76b35df7275e48ce"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar serviços
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log('Firebase inicializado com sucesso!');
