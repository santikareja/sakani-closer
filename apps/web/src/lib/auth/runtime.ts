import "server-only";

import { DrizzleAuthRepository } from "./repository";
import { createAuthService } from "./service";

const repository = new DrizzleAuthRepository();
const service = createAuthService(repository);

export function getAuthRepository(): DrizzleAuthRepository {
  return repository;
}

export function getAuthService() {
  return service;
}
