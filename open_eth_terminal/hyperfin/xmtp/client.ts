/**
 * @file XMTP Chat Client
 *
 * Wraps @xmtp/node-sdk to provide a simplified interface for the HyperFin terminal.
 * Handles client creation, conversation listing, and message sending/receiving.
 *
 * Uses Deno-native Web Crypto API and @xmtp/node-sdk (installed via deno add).
 */

import { getOrCreateAccount, type XmtpAccount } from "./account.ts";

// XMTP SDK — installed via `deno add npm:@xmtp/node-sdk`
import { Client } from "@xmtp/node-sdk";

export interface ChatContact {
  inboxId: string;
  displayName: string;
  lastMessage?: string;
  lastMessageTime?: Date;
}

export interface ChatMessage {
  id: string;
  senderInboxId: string;
  senderName: string;
  content: string;
  sentAt: Date;
  isOutgoing: boolean;
}

export interface ChatConversation {
  id: string;
  contact: ChatContact;
  messages: ChatMessage[];
}

/**
 * XMTP Chat Client — manages the connection to the XMTP network.
 */
export class XmtpChatClient {
  private client: any = null;
  private account: XmtpAccount | null = null;
  private myInboxId: string = "";
  private conversations: Map<string, ChatConversation> = new Map();
  private messageStream: any = null;

  /**
   * Returns the current account info.
   */
  getAccount(): XmtpAccount | null {
    return this.account;
  }

  /**
   * Returns whether the client is connected.
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Connects to the XMTP network.
   * Creates a signer from the stored private key and initializes the client.
   */
  async connect(): Promise<void> {
    try {
      this.account = await getOrCreateAccount();

      const privateKeyBytes = hexToBytes(this.account.privateKey);

      // Create a simple EOA signer using Web Crypto for HMAC signing
      // IdentifierKind.Ethereum = 0 (const enum, can't import with isolatedModules)
      const signer = {
        type: "EOA" as const,
        getIdentifier: () => ({
          identifier: this.account!.address,
          identifierKind: 0 as const, // IdentifierKind.Ethereum
        }),
        signMessage: async (message: string): Promise<Uint8Array> => {
          const key = await crypto.subtle.importKey(
            "raw",
            privateKeyBytes.buffer as ArrayBuffer,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          );
          const encoder = new TextEncoder();
          const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
          return new Uint8Array(signature);
        },
      };

      const dbEncryptionKey = crypto.getRandomValues(new Uint8Array(32));
      this.client = await Client.create(signer, { dbEncryptionKey });

      // Get our inbox ID
      this.myInboxId = await this.client.inboxId();

      // Sync conversations
      await this.client.conversations.syncAll(["allowed"]);

      // Load existing conversations
      await this.refreshConversations();

      // Start streaming new messages
      this.startMessageStream();
    } catch (error) {
      console.error("Failed to connect to XMTP:", error);
      throw error;
    }
  }

  /**
   * Refreshes the conversation list from the network.
   */
  async refreshConversations(): Promise<ChatContact[]> {
    if (!this.client) return [];

    try {
      const allConversations = await this.client.conversations.list({
        consentStates: ["Allowed"],
      });

      const contacts: ChatContact[] = [];

      for (const conv of allConversations) {
        const id = conv.id || conv.topic;
        const members = conv.members || [];
        const otherMembers = members.filter((m: any) => m.inboxId !== this.myInboxId);

        const contact: ChatContact = {
          inboxId: id,
          displayName: otherMembers.map((m: any) =>
            m.accountIdentifiers?.[0]?.identifier?.slice(0, 10) || "Unknown"
          ).join(", ") || "Group",
        };

        // Load recent messages
        const messages = await this.loadMessages(id);

        if (messages.length > 0) {
          const last = messages[messages.length - 1];
          contact.lastMessage = last.content.slice(0, 50);
          contact.lastMessageTime = last.sentAt;
        }

        contacts.push(contact);

        this.conversations.set(id, {
          id,
          contact,
          messages,
        });
      }

      return contacts;
    } catch (error) {
      console.error("Failed to refresh conversations:", error);
      return [];
    }
  }

  /**
   * Loads messages for a specific conversation.
   */
  async loadMessages(conversationId: string, limit: number = 50): Promise<ChatMessage[]> {
    if (!this.client) return [];

    try {
      const conv = await this.client.conversations.findConversationById(conversationId);
      if (!conv) return [];

      const rawMessages = await conv.messages({ limit });
      return rawMessages.map((msg: any) => ({
        id: msg.id || msg.uuid || crypto.randomUUID(),
        senderInboxId: msg.senderInboxId,
        senderName: msg.senderInboxId === this.myInboxId ? "Me" :
          (msg.senderAccountIdentifiers?.[0]?.identifier?.slice(0, 10) || "Unknown"),
        content: msg.content || msg.text || "",
        sentAt: new Date(msg.sentAt || msg.sent || Date.now()),
        isOutgoing: msg.senderInboxId === this.myInboxId,
      }));
    } catch (error) {
      console.error("Failed to load messages:", error);
      return [];
    }
  }

  /**
   * Sends a text message to a conversation.
   */
  async sendMessage(conversationId: string, text: string): Promise<ChatMessage | null> {
    if (!this.client) return null;

    try {
      const conv = await this.client.conversations.findConversationById(conversationId);
      if (!conv) return null;

      const sent = await conv.send(text);

      const message: ChatMessage = {
        id: sent.id || sent.uuid || crypto.randomUUID(),
        senderInboxId: this.myInboxId,
        senderName: "Me",
        content: text,
        sentAt: new Date(),
        isOutgoing: true,
      };

      // Add to local cache
      const existing = this.conversations.get(conversationId);
      if (existing) {
        existing.messages.push(message);
      }

      return message;
    } catch (error) {
      console.error("Failed to send message:", error);
      return null;
    }
  }

  /**
   * Starts a new conversation with a given address.
   */
  async startConversation(address: string): Promise<ChatConversation | null> {
    if (!this.client) return null;

    try {
      const group = await this.client.conversations.newConversation([address]);
      const id = group.id || group.topic;

      const contact: ChatContact = {
        inboxId: id,
        displayName: address.slice(0, 10) + "...",
      };

      const conversation: ChatConversation = {
        id,
        contact,
        messages: [],
      };

      this.conversations.set(id, conversation);
      return conversation;
    } catch (error) {
      console.error("Failed to start conversation:", error);
      return null;
    }
  }

  /**
   * Gets a conversation by ID.
   */
  getConversation(id: string): ChatConversation | undefined {
    return this.conversations.get(id);
  }

  /**
   * Gets all cached conversations.
   */
  getAllConversations(): ChatConversation[] {
    return Array.from(this.conversations.values());
  }

  /**
   * Starts streaming new messages from the network.
   */
  private async startMessageStream(): Promise<void> {
    if (!this.client) return;

    try {
      this.messageStream = await this.client.conversations.streamAllMessages({
        consentStates: ["Allowed"],
        onValue: (message: any) => {
          this.handleIncomingMessage(message);
        },
        onError: (error: any) => {
          console.error("Message stream error:", error);
        },
      });
    } catch (error) {
      console.error("Failed to start message stream:", error);
    }
  }

  /**
   * Handles an incoming message from the stream.
   */
  private handleIncomingMessage(message: any): void {
    const conversationId = message.conversationId || message.topic;
    if (!conversationId) return;

    const chatMessage: ChatMessage = {
      id: message.id || message.uuid || crypto.randomUUID(),
      senderInboxId: message.senderInboxId,
      senderName: message.senderInboxId === this.myInboxId ? "Me" :
        (message.senderAccountIdentifiers?.[0]?.identifier?.slice(0, 10) || "Unknown"),
      content: message.content || message.text || "",
      sentAt: new Date(message.sentAt || message.sent || Date.now()),
      isOutgoing: message.senderInboxId === this.myInboxId,
    };

    const existing = this.conversations.get(conversationId);
    if (existing) {
      existing.messages.push(chatMessage);
      existing.contact.lastMessage = chatMessage.content.slice(0, 50);
      existing.contact.lastMessageTime = chatMessage.sentAt;
    }
  }

  /**
   * Disconnects from the XMTP network.
   */
  async disconnect(): Promise<void> {
    if (this.messageStream) {
      try {
        await this.messageStream.return?.();
      } catch { /* ignore */ }
      this.messageStream = null;
    }
    this.client = null;
  }
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
