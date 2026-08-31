import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface Conversation {
  id?: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  durationSeconds?: number;
  summary?: string;
}

export interface Message {
  id?: string;
  role: "user" | "model";
  text: string;
  createdAt: string;
}

export interface Memory {
  id?: string;
  userId: string;
  content: string;
  category: "preference" | "interest" | "project" | "personal" | "general";
  createdAt: string;
}

export interface SourceDoc {
  id?: string;
  userId: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: string;
}

export interface UserSettings {
  userId: string;
  preferredName?: string;
  voiceId: "Puck" | "Charon" | "Kore" | "Fenrir" | "Zephyr";
  personality: "default" | "empathetic" | "witty" | "supportive" | "direct";
  humor?: "moderate" | "none" | "high";
  interruptionSensitivity?: number;
  memoryEnabled: boolean;
}

// Local Storage Helper Utilities
const isClient = typeof window !== "undefined";

function getLocalItem(key: string): string | null {
  if (!isClient) return null;
  return localStorage.getItem(key);
}

function setLocalItem(key: string, value: string): void {
  if (!isClient) return;
  localStorage.setItem(key, value);
}

function removeLocalItem(key: string): void {
  if (!isClient) return;
  localStorage.removeItem(key);
}

// User Settings CRUD
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  if (userId === "local-user") {
    try {
      const data = getLocalItem("settings_local-user");
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Local settings fetch error:", e);
      return null;
    }
  }
  try {
    const docRef = doc(db, "settings", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserSettings;
    }
    return null;
  } catch (error) {
    console.warn("Firestore error fetching settings, falling back to local storage:", error);
    try {
      const data = getLocalItem(`settings_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
}

export async function saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
  if (userId === "local-user") {
    try {
      const current = getLocalItem("settings_local-user");
      const currentParsed = current ? JSON.parse(current) : { userId, voiceId: "Puck", personality: "default", memoryEnabled: true };
      const updated = { ...currentParsed, ...settings };
      setLocalItem("settings_local-user", JSON.stringify(updated));
      return;
    } catch (e) {
      console.error("Local settings save error:", e);
      return;
    }
  }
  try {
    const docRef = doc(db, "settings", userId);
    await setDoc(docRef, { userId, ...settings }, { merge: true });
  } catch (error) {
    console.warn("Firestore error saving settings, saving locally:", error);
    try {
      const current = getLocalItem(`settings_${userId}`);
      const currentParsed = current ? JSON.parse(current) : { userId, voiceId: "Puck", personality: "default", memoryEnabled: true };
      const updated = { ...currentParsed, ...settings };
      setLocalItem(`settings_${userId}`, JSON.stringify(updated));
    } catch (e) {
      console.error("Local settings save fallback error:", e);
    }
  }
}

// Conversations CRUD
export async function createConversation(userId: string, title: string): Promise<string> {
  if (userId === "local-user") {
    const id = `local_conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();
    const newConv: Conversation = {
      id,
      userId,
      title,
      createdAt,
      updatedAt: createdAt,
      durationSeconds: 0,
      summary: ""
    };
    try {
      const listStr = getLocalItem("conversations_local-user");
      const list: Conversation[] = listStr ? JSON.parse(listStr) : [];
      list.unshift(newConv);
      setLocalItem("conversations_local-user", JSON.stringify(list));
      return id;
    } catch (e) {
      console.error("Local conversation create error:", e);
      return id;
    }
  }
  try {
    const convCol = collection(db, "conversations");
    const createdAt = new Date().toISOString();
    const docRef = await addDoc(convCol, {
      userId,
      title,
      createdAt,
      updatedAt: createdAt,
      durationSeconds: 0,
      summary: ""
    });
    return docRef.id;
  } catch (error) {
    console.warn("Firestore error creating conversation, creating locally:", error);
    const id = `local_conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();
    const newConv: Conversation = {
      id,
      userId,
      title,
      createdAt,
      updatedAt: createdAt,
      durationSeconds: 0,
      summary: ""
    };
    try {
      const listStr = getLocalItem(`conversations_${userId}`);
      const list: Conversation[] = listStr ? JSON.parse(listStr) : [];
      list.unshift(newConv);
      setLocalItem(`conversations_${userId}`, JSON.stringify(list));
    } catch (e) {
      console.error("Local conversation fallback error:", e);
    }
    return id;
  }
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const sanitizeConversations = (raw: Conversation[]): Conversation[] => {
    const seen = new Set<string>();
    return raw.map((item, idx) => {
      let uniqueId = item.id || `conv_${idx}_${Date.now()}`;
      if (seen.has(uniqueId)) {
        uniqueId = `${uniqueId}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      }
      seen.add(uniqueId);
      return { ...item, id: uniqueId };
    });
  };

  if (userId === "local-user") {
    try {
      const listStr = getLocalItem("conversations_local-user");
      const raw = listStr ? JSON.parse(listStr) : [];
      return sanitizeConversations(raw);
    } catch (e) {
      return [];
    }
  }
  try {
    const convCol = collection(db, "conversations");
    const q = query(convCol, where("userId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const conversations: Conversation[] = [];
    querySnapshot.forEach((doc) => {
      conversations.push({ id: doc.id, ...doc.data() } as Conversation);
    });
    return sanitizeConversations(conversations);
  } catch (error) {
    console.warn("Firestore error fetching conversations, falling back to local storage:", error);
    try {
      const listStr = getLocalItem(`conversations_${userId}`);
      const raw = listStr ? JSON.parse(listStr) : [];
      return sanitizeConversations(raw);
    } catch (e) {
      return [];
    }
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  if (conversationId.startsWith("local_")) {
    try {
      const listStr = getLocalItem("conversations_local-user");
      if (listStr) {
        const list: Conversation[] = JSON.parse(listStr);
        const filtered = list.filter((c) => c.id !== conversationId);
        setLocalItem("conversations_local-user", JSON.stringify(filtered));
      }
      removeLocalItem(`messages_${conversationId}`);
    } catch (e) {
      console.error("Local conversation deletion error:", e);
    }
    return;
  }
  try {
    const messagesCol = collection(db, "conversations", conversationId, "messages");
    const messagesSnapshot = await getDocs(messagesCol);
    const deletePromises = messagesSnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    const docRef = doc(db, "conversations", conversationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Firestore error deleting conversation, trying local:", error);
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("conversations_")) {
          const listStr = localStorage.getItem(key);
          if (listStr) {
            const list: Conversation[] = JSON.parse(listStr);
            const filtered = list.filter((c) => c.id !== conversationId);
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      }
      removeLocalItem(`messages_${conversationId}`);
    } catch (e) {
      console.error("Local deletion fallback error:", e);
    }
  }
}

export async function updateConversation(
  conversationId: string,
  updates: Partial<Conversation>
): Promise<void> {
  if (conversationId.startsWith("local_")) {
    try {
      const listStr = getLocalItem("conversations_local-user");
      if (listStr) {
        const list: Conversation[] = JSON.parse(listStr);
        const updated = list.map((c) => {
          if (c.id === conversationId) {
            return { ...c, ...updates, updatedAt: new Date().toISOString() };
          }
          return c;
        });
        setLocalItem("conversations_local-user", JSON.stringify(updated));
      }
    } catch (e) {
      console.error("Local conversation update error:", e);
    }
    return;
  }
  try {
    const docRef = doc(db, "conversations", conversationId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("Firestore error updating conversation, trying local:", error);
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("conversations_")) {
          const listStr = localStorage.getItem(key);
          if (listStr) {
            const list: Conversation[] = JSON.parse(listStr);
            const updated = list.map((c) => {
              if (c.id === conversationId) {
                return { ...c, ...updates, updatedAt: new Date().toISOString() };
              }
              return c;
            });
            localStorage.setItem(key, JSON.stringify(updated));
          }
        }
      }
    } catch (e) {
      console.error("Local update fallback error:", e);
    }
  }
}

// Messages CRUD
export async function addMessageToConversation(
  conversationId: string,
  role: "user" | "model",
  text: string
): Promise<string> {
  if (conversationId.startsWith("local_")) {
    const messageId = `local_msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const createdAt = new Date().toISOString();
    const newMessage: Message = {
      id: messageId,
      role,
      text,
      createdAt
    };
    try {
      const key = `messages_${conversationId}`;
      const listStr = getLocalItem(key);
      const list: Message[] = listStr ? JSON.parse(listStr) : [];
      list.push(newMessage);
      setLocalItem(key, JSON.stringify(list));
      
      await updateConversation(conversationId, {});
    } catch (e) {
      console.error("Local message add error:", e);
    }
    return messageId;
  }
  try {
    const messagesCol = collection(db, "conversations", conversationId, "messages");
    const createdAt = new Date().toISOString();
    const docRef = await addDoc(messagesCol, {
      role,
      text,
      createdAt
    });

    await updateConversation(conversationId, {});

    return docRef.id;
  } catch (error) {
    console.warn("Firestore error adding message, writing locally:", error);
    const messageId = `local_msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const createdAt = new Date().toISOString();
    const newMessage: Message = {
      id: messageId,
      role,
      text,
      createdAt
    };
    try {
      const key = `messages_${conversationId}`;
      const listStr = getLocalItem(key);
      const list: Message[] = listStr ? JSON.parse(listStr) : [];
      list.push(newMessage);
      setLocalItem(key, JSON.stringify(list));
      
      await updateConversation(conversationId, {});
    } catch (e) {
      console.error("Local message add fallback error:", e);
    }
    return messageId;
  }
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const sanitizeMessages = (raw: Message[]): Message[] => {
    const seen = new Set<string>();
    return raw.map((item, idx) => {
      let uniqueId = item.id || `msg_${idx}_${Date.now()}`;
      if (seen.has(uniqueId)) {
        uniqueId = `${uniqueId}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      }
      seen.add(uniqueId);
      return { ...item, id: uniqueId };
    });
  };

  if (conversationId.startsWith("local_")) {
    try {
      const listStr = getLocalItem(`messages_${conversationId}`);
      const raw = listStr ? JSON.parse(listStr) : [];
      return sanitizeMessages(raw);
    } catch (e) {
      return [];
    }
  }
  try {
    const messagesCol = collection(db, "conversations", conversationId, "messages");
    const q = query(messagesCol, orderBy("createdAt", "asc"));
    const querySnapshot = await getDocs(q);
    const messages: Message[] = [];
    querySnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as Message);
    });
    return sanitizeMessages(messages);
  } catch (error) {
    console.warn("Firestore error fetching messages, falling back to local storage:", error);
    try {
      const listStr = getLocalItem(`messages_${conversationId}`);
      const raw = listStr ? JSON.parse(listStr) : [];
      return sanitizeMessages(raw);
    } catch (e) {
      return [];
    }
  }
}

// Memories CRUD
export async function addMemory(
  userId: string,
  content: string,
  category: "preference" | "interest" | "project" | "personal" | "general"
): Promise<string> {
  if (userId === "local-user") {
    const id = `local_mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();
    const newMemory: Memory = {
      id,
      userId,
      content,
      category,
      createdAt
    };
    try {
      const listStr = getLocalItem("memories_local-user");
      const list: Memory[] = listStr ? JSON.parse(listStr) : [];
      list.unshift(newMemory);
      setLocalItem("memories_local-user", JSON.stringify(list));
      return id;
    } catch (e) {
      console.error("Local memory save error:", e);
      return id;
    }
  }
  try {
    const memoriesCol = collection(db, "memories");
    const createdAt = new Date().toISOString();
    const docRef = await addDoc(memoriesCol, {
      userId,
      content,
      category,
      createdAt
    });
    return docRef.id;
  } catch (error) {
    console.warn("Firestore error adding memory, saving locally:", error);
    const id = `local_mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();
    const newMemory: Memory = {
      id,
      userId,
      content,
      category,
      createdAt
    };
    try {
      const listStr = getLocalItem(`memories_${userId}`);
      const list: Memory[] = listStr ? JSON.parse(listStr) : [];
      list.unshift(newMemory);
      setLocalItem(`memories_${userId}`, JSON.stringify(list));
    } catch (e) {
      console.error("Local memory add fallback error:", e);
    }
    return id;
  }
}

export async function getMemories(userId: string): Promise<Memory[]> {
  const sanitizeList = (raw: Memory[]): Memory[] => {
    const seen = new Set<string>();
    return raw.map((item, idx) => {
      let uniqueId = item.id || `mem_${idx}_${Date.now()}`;
      if (seen.has(uniqueId)) {
        uniqueId = `${uniqueId}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      }
      seen.add(uniqueId);
      return { ...item, id: uniqueId };
    });
  };

  if (userId === "local-user") {
    try {
      const listStr = getLocalItem("memories_local-user");
      const raw = listStr ? JSON.parse(listStr) : [];
      return sanitizeList(raw);
    } catch (e) {
      return [];
    }
  }
  try {
    const memoriesCol = collection(db, "memories");
    const q = query(memoriesCol, where("userId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const memories: Memory[] = [];
    querySnapshot.forEach((doc) => {
      memories.push({ id: doc.id, ...doc.data() } as Memory);
    });
    return sanitizeList(memories);
  } catch (error) {
    console.warn("Firestore error fetching memories, falling back to local storage:", error);
    try {
      const listStr = getLocalItem(`memories_${userId}`);
      const raw = listStr ? JSON.parse(listStr) : [];
      return sanitizeList(raw);
    } catch (e) {
      return [];
    }
  }
}

export async function deleteMemory(memoryId: string): Promise<void> {
  if (memoryId.startsWith("local_")) {
    try {
      const listStr = getLocalItem("memories_local-user");
      if (listStr) {
        const list: Memory[] = JSON.parse(listStr);
        const filtered = list.filter((m) => m.id !== memoryId);
        setLocalItem("memories_local-user", JSON.stringify(filtered));
      }
    } catch (e) {
      console.error("Local memory deletion error:", e);
    }
    return;
  }
  try {
    const docRef = doc(db, "memories", memoryId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Firestore error deleting memory, trying local:", error);
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("memories_")) {
          const listStr = localStorage.getItem(key);
          if (listStr) {
            const list: Memory[] = JSON.parse(listStr);
            const filtered = list.filter((m) => m.id !== memoryId);
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      }
    } catch (e) {
      console.error("Local memory deletion fallback error:", e);
    }
  }
}

// Knowledge Documents (SourceDoc) CRUD
export async function addSourceDoc(userId: string, docData: Omit<SourceDoc, "id" | "userId">): Promise<string> {
  if (userId === "local-user") {
    const id = `local_doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newDoc: SourceDoc = {
      id,
      userId,
      ...docData
    };
    try {
      const listStr = getLocalItem("knowledge_local-user");
      const list: SourceDoc[] = listStr ? JSON.parse(listStr) : [];
      list.unshift(newDoc);
      setLocalItem("knowledge_local-user", JSON.stringify(list));
      return id;
    } catch (e) {
      console.error("Local document save error:", e);
      return id;
    }
  }
  try {
    const docCol = collection(db, "knowledge");
    const docRef = await addDoc(docCol, {
      userId,
      ...docData
    });
    return docRef.id;
  } catch (error) {
    console.warn("Firestore error adding document, saving locally:", error);
    const id = `local_doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newDoc: SourceDoc = {
      id,
      userId,
      ...docData
    };
    try {
      const listStr = getLocalItem(`knowledge_${userId}`);
      const list: SourceDoc[] = listStr ? JSON.parse(listStr) : [];
      list.unshift(newDoc);
      setLocalItem(`knowledge_${userId}`, JSON.stringify(list));
    } catch (e) {
      console.error("Local document add fallback error:", e);
    }
    return id;
  }
}

export async function getSourceDocs(userId: string): Promise<SourceDoc[]> {
  if (userId === "local-user") {
    try {
      const listStr = getLocalItem("knowledge_local-user");
      return listStr ? JSON.parse(listStr) : [];
    } catch (e) {
      return [];
    }
  }
  try {
    const docCol = collection(db, "knowledge");
    const q = query(docCol, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const docs: SourceDoc[] = [];
    querySnapshot.forEach((doc) => {
      docs.push({ id: doc.id, ...doc.data() } as SourceDoc);
    });
    // Sort in memory by uploadedAt descending to avoid Firestore composite index requirement
    return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (error) {
    console.warn("Firestore error fetching documents, falling back to local storage:", error);
    try {
      const listStr = getLocalItem(`knowledge_${userId}`);
      return listStr ? JSON.parse(listStr) : [];
    } catch (e) {
      return [];
    }
  }
}

export async function deleteSourceDoc(docId: string): Promise<void> {
  if (docId.startsWith("local_")) {
    try {
      const listStr = getLocalItem("knowledge_local-user");
      if (listStr) {
        const list: SourceDoc[] = JSON.parse(listStr);
        const filtered = list.filter((d) => d.id !== docId);
        setLocalItem("knowledge_local-user", JSON.stringify(filtered));
      }
    } catch (e) {
      console.error("Local document deletion error:", e);
    }
    return;
  }
  try {
    const docRef = doc(db, "knowledge", docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Firestore error deleting document, trying local:", error);
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("knowledge_")) {
          const listStr = localStorage.getItem(key);
          if (listStr) {
            const list: SourceDoc[] = JSON.parse(listStr);
            const filtered = list.filter((d) => d.id !== docId);
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      }
    } catch (e) {
      console.error("Local document deletion fallback error:", e);
    }
  }
}
