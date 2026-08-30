import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  projectId: 'mailinglove-eb540',
  appId: '1:1046999905227:web:6244c5ddf6548d1a6dbc4e',
  storageBucket: 'mailinglove-eb540.firebasestorage.app',
  apiKey: 'AIzaSyBxos07OB8LufW6zWfURrNegAM6InsOFWs',
  authDomain: 'mailinglove-eb540.firebaseapp.com',
  messagingSenderId: '1046999905227',
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
