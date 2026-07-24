import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  UserCredential,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth } from './firebase.service';


export class AuthService {
 static async login(email: string, password: string): Promise<UserCredential> {
  console.log("1");
  const result = await signInWithEmailAndPassword(auth, email, password);
  console.log("2");
  return result;
}

  static async register(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  static async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  static async logout(): Promise<void> {
    await signOut(auth);
  }
static async signInWithGoogle(): Promise<UserCredential> {
  console.log("A");

  const result = await FirebaseAuthentication.signInWithGoogle();

  console.log("B", result);

  const idToken = result.credential?.idToken;

  console.log("C", idToken);

  if (!idToken) {
    throw new Error("Google لم يرجع ID Token");
  }

  const credential = GoogleAuthProvider.credential(idToken);

  console.log("D");

  return await signInWithCredential(auth, credential);
}
  static currentUser() {
    return auth.currentUser;
  }
}