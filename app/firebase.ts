import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

export type Player = { id: string; name: string; avatar: string; color: string; active: number; createdAt?: string };
export type GameSession = { id: string; playedAt: string; season: string; rounds: number; note: string; createdAt: string };
export type GameResult = {
  id: string;
  sessionId: string;
  playerId: string;
  amount: number;
  placement: number;
  wins: number;
  selfDraws: number;
  dealsIn: number;
};
export type LedgerData = { players: Player[]; sessions: GameSession[]; results: GameResult[] };
export type SeatResultInput = {
  playerId: string;
  amount: number;
  wins: number;
  selfDraws: number;
  dealsIn: number;
};

const firebaseConfig = {
  apiKey: "AIzaSyAFd6KqocY-AlUZXiNSkJ-X9iI1rAmz8C8",
  authDomain: "chang-ma-guan.firebaseapp.com",
  projectId: "chang-ma-guan",
  storageBucket: "chang-ma-guan.firebasestorage.app",
  messagingSenderId: "546334593142",
  appId: "1:546334593142:web:c53457af40d33cecaccf57",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getFirestore(app);
const savedRoomKey = "chang-ma-guan-room";

function timestampToText(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return typeof value === "string" ? value : "";
}

function normalizeAvatar(value: string, name: string) {
  return Array.from(value.trim())[0] ?? Array.from(name.trim())[0] ?? "?";
}

export async function ensureGuestAuth() {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, async (user) => {
      if (user) {
        stop();
        resolve(user);
        return;
      }
      try {
        const credential = await signInAnonymously(auth);
        stop();
        resolve(credential.user);
      } catch (error) {
        stop();
        reject(error);
      }
    }, reject);
  });
}

async function hashRoomCode(code: string) {
  const normalized = code.trim().normalize("NFKC");
  if (normalized.length < 8) throw new Error("通關碼請至少輸入 8 個字元");
  const bytes = new TextEncoder().encode(`chang-ma-guan:${normalized}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function roomRef(roomId: string) {
  return doc(database, "rooms", roomId);
}

export function getSavedRoomId() {
  return window.localStorage.getItem(savedRoomKey);
}

export function forgetSavedRoom() {
  window.localStorage.removeItem(savedRoomKey);
}

export async function restoreRoom(roomId: string) {
  await ensureGuestAuth();
  const snapshot = await getDoc(roomRef(roomId));
  if (!snapshot.exists()) {
    forgetSavedRoom();
    return null;
  }
  return roomId;
}

export async function enterRoom(code: string) {
  await ensureGuestAuth();
  const roomId = await hashRoomCode(code);
  const snapshot = await getDoc(roomRef(roomId));
  if (!snapshot.exists()) throw new Error("找不到這個張麻館，請確認通關碼是否正確");
  window.localStorage.setItem(savedRoomKey, roomId);
  return roomId;
}

export async function createRoom(code: string) {
  await ensureGuestAuth();
  const roomId = await hashRoomCode(code);
  const reference = roomRef(roomId);
  if ((await getDoc(reference)).exists()) throw new Error("這個通關碼已經建立過，請直接進入");
  await setDoc(reference, { name: "張麻館", createdAt: serverTimestamp(), version: 1 });
  window.localStorage.setItem(savedRoomKey, roomId);
  return roomId;
}

export function watchLedger(roomId: string, onData: (data: LedgerData) => void, onError: (message: string) => void) {
  const current: LedgerData = { players: [], sessions: [], results: [] };
  const ready = { players: false, sessions: false, results: false };
  const emit = () => {
    if (ready.players && ready.sessions && ready.results) onData({ ...current });
  };
  const fail = (error: Error) => onError(error.message || "讀取資料失敗");

  const stopPlayers = onSnapshot(
    query(collection(database, "rooms", roomId, "players"), orderBy("createdAt", "asc")),
    (snapshot) => {
      current.players = snapshot.docs.map((row) => {
        const value = row.data();
        return { id: row.id, name: String(value.name ?? ""), avatar: String(value.avatar ?? ""), color: String(value.color ?? "#167c5a"), active: Number(value.active ?? 1), createdAt: timestampToText(value.createdAt) };
      });
      ready.players = true;
      emit();
    },
    fail,
  );
  const stopSessions = onSnapshot(
    query(collection(database, "rooms", roomId, "sessions"), orderBy("playedAt", "desc")),
    (snapshot) => {
      current.sessions = snapshot.docs.map((row) => {
        const value = row.data();
        return { id: row.id, playedAt: String(value.playedAt ?? ""), season: String(value.season ?? "本季"), rounds: Number(value.rounds ?? 1), note: String(value.note ?? ""), createdAt: timestampToText(value.createdAt) };
      });
      ready.sessions = true;
      emit();
    },
    fail,
  );
  const stopResults = onSnapshot(collection(database, "rooms", roomId, "results"), (snapshot) => {
    current.results = snapshot.docs.map((row) => {
      const value = row.data();
      return {
        id: row.id,
        sessionId: String(value.sessionId ?? ""),
        playerId: String(value.playerId ?? ""),
        amount: Number(value.amount ?? 0),
        placement: Number(value.placement ?? 4),
        wins: Number(value.wins ?? 0),
        selfDraws: Number(value.selfDraws ?? 0),
        dealsIn: Number(value.dealsIn ?? 0),
      };
    });
    ready.results = true;
    emit();
  }, fail);

  return () => {
    stopPlayers();
    stopSessions();
    stopResults();
  };
}

export async function addPlayerRecord(roomId: string, input: { name: string; avatar: string; color: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("請輸入成員名稱");
  const id = crypto.randomUUID();
  await setDoc(doc(database, "rooms", roomId, "players", id), {
    name,
    avatar: normalizeAvatar(input.avatar, name),
    color: input.color,
    active: 1,
    createdAt: serverTimestamp(),
  });
}

export async function updatePlayerRecord(roomId: string, player: Player) {
  const name = player.name.trim();
  if (!name) throw new Error("請輸入成員名稱");
  await updateDoc(doc(database, "rooms", roomId, "players", player.id), {
    name,
    avatar: normalizeAvatar(player.avatar, name),
    color: player.color,
    active: player.active ? 1 : 0,
  });
}

export async function removePlayerRecord(roomId: string, player: Player) {
  const used = await getDocs(query(collection(database, "rooms", roomId, "results"), where("playerId", "==", player.id), limit(1)));
  const reference = doc(database, "rooms", roomId, "players", player.id);
  if (used.empty) await deleteDoc(reference);
  else await updateDoc(reference, { active: 0 });
}

export async function saveGameRecord(roomId: string, input: {
  id?: string | null;
  playedAt: string;
  season: string;
  rounds: number;
  note: string;
  results: SeatResultInput[];
}) {
  if (!input.playedAt) throw new Error("請選擇日期");
  if (input.results.length !== 4 || new Set(input.results.map((row) => row.playerId)).size !== 4) throw new Error("請選擇 4 位不同的成員");
  if (input.results.reduce((sum, row) => sum + row.amount, 0) !== 0) throw new Error("四位成員的輸贏加總必須為 0");

  const sessionId = input.id || crypto.randomUUID();
  const oldResults = input.id
    ? await getDocs(query(collection(database, "rooms", roomId, "results"), where("sessionId", "==", sessionId)))
    : null;
  const sorted = [...input.results].sort((a, b) => b.amount - a.amount);
  const placements = new Map(sorted.map((row, index) => [row.playerId, index + 1]));
  const batch = writeBatch(database);
  batch.set(doc(database, "rooms", roomId, "sessions", sessionId), {
    playedAt: input.playedAt,
    season: input.season.trim() || "本季",
    rounds: Math.max(1, input.rounds || 1),
    note: input.note.trim(),
    createdAt: serverTimestamp(),
  });
  oldResults?.docs.forEach((row) => batch.delete(row.ref));
  input.results.forEach((row) => {
    const id = crypto.randomUUID();
    batch.set(doc(database, "rooms", roomId, "results", id), {
      sessionId,
      playerId: row.playerId,
      amount: row.amount,
      placement: placements.get(row.playerId) ?? 4,
      wins: Math.max(0, row.wins || 0),
      selfDraws: Math.max(0, row.selfDraws || 0),
      dealsIn: Math.max(0, row.dealsIn || 0),
    });
  });
  await batch.commit();
}

export async function deleteGameRecord(roomId: string, sessionId: string) {
  const oldResults = await getDocs(query(collection(database, "rooms", roomId, "results"), where("sessionId", "==", sessionId)));
  const batch = writeBatch(database);
  oldResults.docs.forEach((row) => batch.delete(row.ref));
  batch.delete(doc(database, "rooms", roomId, "sessions", sessionId));
  await batch.commit();
}
