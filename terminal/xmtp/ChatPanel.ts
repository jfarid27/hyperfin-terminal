/**
 * @file ChatPanel — XMTP chat UI for the HyperFin terminal.
 *
 * Layout (replaces the data area when in chat mode):
 * ┌────────────┬──────────────────────────────────┐
 * │ Contacts   │  Messages                        │
 * │ (25%)      │  (75%)                           │
 * │            │                                  │
 * │ [Alice]    │  Alice: Hey, how's it going?     │
 * │ [Bob]   ←  │  You:   Pretty good!             │
 * │ [Carol]    │  Alice: Want to trade?           │
 * │            │                                  │
 * │            │  ─────────────────────────────  │
 * │            │  > Type a message...             │
 * └────────────┴──────────────────────────────────┘
 *
 * Keyboard shortcuts:
 *   ↑/↓     — Navigate contacts / scroll messages
 *   Tab     — Switch between contacts pane and message input
 *   Enter   — Send message (when in input mode)
 *   Esc     — Exit chat mode
 */

import terminalKit from "terminal-kit";
import chalk from "chalk";
import { XmtpChatClient, type ChatContact, type ChatMessage, type ChatConversation } from "./client.ts";

const term = terminalKit.terminal;

export type ChatMode = "contacts" | "input";

export interface ChatPanelState {
  contacts: ChatContact[];
  selectedContactIndex: number;
  currentConversation: ChatConversation | null;
  messages: ChatMessage[];
  messageScrollOffset: number;
  mode: ChatMode;
  inputText: string;
  statusText: string;
  connected: boolean;
  myAddress: string;
}

/**
 * ChatPanel manages the XMTP chat UI within the HyperFin terminal.
 */
export class ChatPanel {
  private client: XmtpChatClient;
  private state: ChatPanelState;
  private width: number;
  private height: number;
  private onExit: (() => void) | null = null;

  constructor() {
    this.client = new XmtpChatClient();
    this.width = term.width || 120;
    this.height = term.height || 40;
    const account = this.client.getAccount();

    this.state = {
      contacts: [],
      selectedContactIndex: 0,
      currentConversation: null,
      messages: [],
      messageScrollOffset: 0,
      mode: "contacts",
      inputText: "",
      statusText: "Connecting to XMTP...",
      connected: false,
      myAddress: account?.address ?? "No account",
    };
  }

  /**
   * Initialize the chat panel — connect to XMTP and load contacts.
   */
  async init(): Promise<void> {
    try {
      await this.client.connect();
      this.state.connected = true;
      this.state.statusText = `Connected — ${this.state.myAddress.slice(0, 12)}...`;
      await this.refreshContacts();
    } catch (error) {
      this.state.statusText = `Connection failed: ${error}`;
    }
  }

  /**
   * Refresh the contact list.
   */
  async refreshContacts(): Promise<void> {
    if (!this.state.connected) return;
    this.state.contacts = await this.client.refreshConversations();
  }

  /**
   * Select a contact and load their conversation.
   */
  async selectContact(index: number): Promise<void> {
    if (index < 0 || index >= this.state.contacts.length) return;

    this.state.selectedContactIndex = index;
    const contact = this.state.contacts[index];
    const conversation = this.client.getConversation(contact.inboxId);

    if (conversation) {
      this.state.currentConversation = conversation;
      this.state.messages = conversation.messages;
    } else {
      this.state.messages = [];
    }

    this.state.messageScrollOffset = Math.max(0, this.state.messages.length - 10);
    this.state.mode = "contacts";
  }

  /**
   * Send a message to the current conversation.
   */
  async sendMessage(): Promise<void> {
    const text = this.state.inputText.trim();
    if (!text || !this.state.currentConversation) return;

    const msg = await this.client.sendMessage(this.state.currentConversation.id, text);
    if (msg) {
      this.state.messages.push(msg);
      this.state.messageScrollOffset = Math.max(0, this.state.messages.length - 10);
    }

    this.state.inputText = "";
    this.state.mode = "contacts";
  }

  /**
   * Start a new conversation with an address.
   */
  async startNewConversation(address: string): Promise<void> {
    const conv = await this.client.startConversation(address);
    if (conv) {
      await this.refreshContacts();
      // Find and select the new conversation
      const idx = this.state.contacts.findIndex(c => c.inboxId === conv.id);
      if (idx >= 0) {
        await this.selectContact(idx);
      }
    }
  }

  /**
   * Set the exit callback.
   */
  setOnExit(callback: () => void): void {
    this.onExit = callback;
  }

  /**
   * Render the chat UI into the given area.
   * Called by the MainPanel when in chat mode.
   */
  render(dataAreaHeight: number): string[] {
    const lines: string[] = [];
    const contactWidth = Math.floor(this.width * 0.25);
    const messageWidth = this.width - contactWidth - 1; // -1 for separator

    // ── Status bar ──
    const statusColor = this.state.connected ? chalk.green : chalk.red;
    lines.push(statusColor(` ${this.state.statusText}`));

    // ── Header row ──
    const contactHeader = chalk.bgBlue(chalk.white(" CONTACTS ".padEnd(contactWidth)));
    const messageHeader = chalk.bgBlue(chalk.white(" MESSAGES ".padEnd(messageWidth)));
    lines.push(contactHeader + chalk.dim("│") + messageHeader);

    // ── Content area ──
    const contentHeight = dataAreaHeight - 2; // -2 for status + header
    const visibleContacts = this.state.contacts.slice(0, contentHeight);
    const visibleMessages = this.getVisibleMessages(contentHeight);

    for (let i = 0; i < contentHeight; i++) {
      // Contact column
      let contactLine = "";
      if (i < visibleContacts.length) {
        const contact = visibleContacts[i];
        const isSelected = i === this.state.selectedContactIndex;
        const prefix = isSelected ? chalk.bgCyan(chalk.black(" → ")) : "   ";
        const name = contact.displayName.slice(0, contactWidth - 4);
        contactLine = prefix + (isSelected ? chalk.cyan(name) : name);
      }
      contactLine = contactLine.padEnd(contactWidth);

      // Message column
      let messageLine = "";
      if (i < visibleMessages.length) {
        const msg = visibleMessages[i];
        const sender = msg.isOutgoing ? chalk.green("You") : chalk.yellow(msg.senderName);
        const content = msg.content.slice(0, messageWidth - msg.senderName.length - 5);
        messageLine = `${sender}: ${content}`;
      }
      messageLine = messageLine.padEnd(messageWidth);

      lines.push(contactLine + chalk.dim("│") + messageLine);
    }

    // ── Input bar ──
    const inputPrefix = this.state.mode === "input" ? chalk.green("> ") : chalk.dim("> ");
    const inputText = this.state.mode === "input"
      ? this.state.inputText + chalk.bgWhite(" ") // cursor
      : this.state.inputText || chalk.dim("Type a message (Tab to focus, Enter to send)");
    lines.push(chalk.dim("─".repeat(this.width)));
    lines.push(inputPrefix + inputText);

    // ── Help bar ──
    lines.push(chalk.dim("↑↓:Navigate  Tab:Switch  Enter:Send  /:New Chat  Esc:Exit  R:Refresh"));

    return lines;
  }

  /**
   * Get the visible message window based on scroll offset.
   */
  private getVisibleMessages(maxLines: number): ChatMessage[] {
    const start = this.state.messageScrollOffset;
    const end = Math.min(start + maxLines, this.state.messages.length);
    return this.state.messages.slice(start, end);
  }

  /**
   * Handle a keypress in chat mode.
   * Returns true if the key was handled, false if it should exit chat mode.
   */
  handleKey(name: string): boolean {
    if (name === "ESCAPE") {
      this.onExit?.();
      return false;
    }

    if (name === "CTRL_C") {
      this.client.disconnect();
      this.onExit?.();
      return false;
    }

    if (this.state.mode === "input") {
      return this.handleInputKey(name);
    }

    return this.handleContactsKey(name);
  }

  /**
   * Handle keypresses when in contacts navigation mode.
   */
  private handleContactsKey(name: string): boolean {
    switch (name) {
      case "UP":
        if (this.state.selectedContactIndex > 0) {
          this.selectContact(this.state.selectedContactIndex - 1);
        }
        return true;

      case "DOWN":
        if (this.state.selectedContactIndex < this.state.contacts.length - 1) {
          this.selectContact(this.state.selectedContactIndex + 1);
        }
        return true;

      case "TAB":
        this.state.mode = "input";
        return true;

      case "PAGE_UP":
        this.state.messageScrollOffset = Math.max(0, this.state.messageScrollOffset - 10);
        return true;

      case "PAGE_DOWN":
        this.state.messageScrollOffset = Math.min(
          Math.max(0, this.state.messages.length - 10),
          this.state.messageScrollOffset + 10,
        );
        return true;

      case "/":
        // Start new conversation
        this.state.mode = "input";
        this.state.inputText = "/new ";
        return true;

      case "r":
      case "R":
        this.refreshContacts();
        return true;

      case "ENTER":
        // If a contact is selected, focus input
        if (this.state.currentConversation) {
          this.state.mode = "input";
        }
        return true;

      default:
        return true;
    }
  }

  /**
   * Handle keypresses when in message input mode.
   */
  private handleInputKey(name: string): boolean {
    switch (name) {
      case "ENTER":
        if (this.state.inputText.startsWith("/new ")) {
          const address = this.state.inputText.slice(5).trim();
          if (address) {
            this.startNewConversation(address);
            this.state.inputText = "";
            this.state.mode = "contacts";
          }
        } else {
          this.sendMessage();
        }
        return true;

      case "TAB":
      case "ESCAPE":
        this.state.mode = "contacts";
        return true;

      case "BACKSPACE":
      case "DELETE":
        if (this.state.inputText.length > 0) {
          this.state.inputText = this.state.inputText.slice(0, -1);
        }
        return true;

      default:
        // Regular character input
        if (name.length === 1) {
          this.state.inputText += name;
        }
        return true;
    }
  }

  /**
   * Clean up resources.
   */
  async destroy(): Promise<void> {
    await this.client.disconnect();
  }
}
