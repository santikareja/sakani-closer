import type { WhatsAppAccountBinding } from "@sakani/shared";
import { z } from "zod";

import type { AuthStore } from "../auth/store.js";

const ACCOUNT_BINDING_KEY = "gateway:account-binding";

const accountBindingSchema = z.object({
  workspaceId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export class AccountBindingStore {
  private binding: WhatsAppAccountBinding | undefined;

  constructor(private readonly store: AuthStore) {}

  async load(): Promise<WhatsAppAccountBinding | undefined> {
    const stored = await this.store.read<unknown>(ACCOUNT_BINDING_KEY);
    this.binding = stored === undefined ? undefined : accountBindingSchema.parse(stored);
    return this.binding;
  }

  get(): WhatsAppAccountBinding | undefined {
    return this.binding;
  }

  async set(binding: WhatsAppAccountBinding): Promise<void> {
    const parsed = accountBindingSchema.parse(binding);
    await this.store.write(ACCOUNT_BINDING_KEY, parsed);
    await this.store.flush();
    this.binding = parsed;
  }
}
