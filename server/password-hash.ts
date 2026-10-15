import {pbkdf2Async} from '@noble/hashes/pbkdf2.js';
import {sha256} from '@noble/hashes/sha2.js';

export const PASSWORD_ITERATIONS=600_000;
const encoder=new TextEncoder();

export async function derivePasswordHash(password:string,salt:string,iterations=PASSWORD_ITERATIONS){
  // Workers' native PBKDF2 rejects more than 100,000 iterations in production.
  // Use the standard portable implementation, preserving the existing UTF-8
  // salt, SHA-256, 32-byte output and base64url format for existing accounts.
  const passwordBytes=encoder.encode(password);
  try{
    const bytes=await pbkdf2Async(sha256,passwordBytes,encoder.encode(salt),{c:iterations,dkLen:32});
    return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  }finally{passwordBytes.fill(0)}
}
