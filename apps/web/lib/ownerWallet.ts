"use client";

import { createClaspWallet, generateKeypair, publicKeyFromPrivate, type ClaspWallet, type Keypair } from "@useclasp/client";
import { SERVER_URL } from "./serverUrl";

const STORAGE_KEY = "clasp.owner.privateKey";

let wallet: ClaspWallet | null = null;

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persist(privateKey: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, privateKey);
  } catch {
    return;
  }
}

function loadOwnerKeypair(): Keypair {
  const stored = readStored();
  if (stored && /^[0-9a-f]{64}$/.test(stored)) return { privateKey: stored, publicKey: publicKeyFromPrivate(stored) };
  const fresh = generateKeypair();
  persist(fresh.privateKey);
  return fresh;
}

export function ownerWallet(): ClaspWallet {
  wallet ??= createClaspWallet({ serverUrl: SERVER_URL, ownerKeypair: loadOwnerKeypair() });
  return wallet;
}
