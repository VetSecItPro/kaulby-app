import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Set a valid 32-byte encryption key before importing the module
const TEST_KEY = "a".repeat(64); // 32 bytes in hex

describe("encryption", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Dynamic import to pick up env changes
  async function loadModule() {
    // Clear module cache so env var is re-read
    const mod = await import("../encryption");
    return mod;
  }

  describe("encrypt/decrypt round-trip", () => {
    it("encrypts and decrypts a simple string", async () => {
      const { encrypt, decrypt } = await loadModule();
      const plaintext = "my-secret-token";
      const encrypted = encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith("enc:")).toBe(true);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it("encrypts and decrypts an empty string", async () => {
      const { encrypt, decrypt } = await loadModule();
      const encrypted = encrypt("");
      expect(decrypt(encrypted)).toBe("");
    });

    it("encrypts and decrypts unicode content", async () => {
      const { encrypt, decrypt } = await loadModule();
      const plaintext = "Hello 世界 🌍";
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it("produces different ciphertexts for the same plaintext (random IV)", async () => {
      const { encrypt } = await loadModule();
      const a = encrypt("same-value");
      const b = encrypt("same-value");
      expect(a).not.toBe(b);
    });
  });

  describe("decrypt plaintext passthrough", () => {
    it("returns plaintext strings as-is (no enc: prefix)", async () => {
      const { decrypt } = await loadModule();
      expect(decrypt("plaintext-token")).toBe("plaintext-token");
    });

    it("returns empty string as-is", async () => {
      const { decrypt } = await loadModule();
      expect(decrypt("")).toBe("");
    });
  });

  describe("decrypt error handling", () => {
    it("throws on invalid encrypted format (wrong number of parts)", async () => {
      const { decrypt } = await loadModule();
      expect(() => decrypt("enc:onlyonepart")).toThrow("Invalid encrypted value format");
    });

    it("throws on tampered ciphertext", async () => {
      const { encrypt, decrypt } = await loadModule();
      const encrypted = encrypt("test");
      // Tamper with the ciphertext portion
      const parts = encrypted.split(":");
      parts[3] = "ff".repeat(parts[3].length / 2);
      const tampered = parts.join(":");
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("getKey validation", () => {
    it("throws when ENCRYPTION_KEY is not set", async () => {
      vi.stubEnv("ENCRYPTION_KEY", "");
      const { encrypt } = await loadModule();
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY not set");
    });

    it("throws when ENCRYPTION_KEY is wrong length", async () => {
      vi.stubEnv("ENCRYPTION_KEY", "abcd");
      const { encrypt } = await loadModule();
      expect(() => encrypt("test")).toThrow("must be exactly 32 bytes");
    });
  });

  describe("encryptIntegrationData", () => {
    it("encrypts only sensitive keys", async () => {
      const { encryptIntegrationData, decrypt } = await loadModule();
      const data = {
        accessToken: "secret-access",
        refreshToken: "secret-refresh",
        webhookUrl: "https://hooks.example.com/abc",
        guildId: "12345",
        channelName: "general",
      };
      const encrypted = encryptIntegrationData(data);

      // Sensitive keys should be encrypted
      expect((encrypted.accessToken as string).startsWith("enc:")).toBe(true);
      expect((encrypted.refreshToken as string).startsWith("enc:")).toBe(true);
      expect((encrypted.webhookUrl as string).startsWith("enc:")).toBe(true);

      // Non-sensitive keys should be unchanged
      expect(encrypted.guildId).toBe("12345");
      expect(encrypted.channelName).toBe("general");

      // Should decrypt back correctly
      expect(decrypt(encrypted.accessToken as string)).toBe("secret-access");
    });

    it("skips empty strings and non-string values", async () => {
      const { encryptIntegrationData } = await loadModule();
      const data = {
        accessToken: "",
        refreshToken: null as unknown as string,
        webhookUrl: 123 as unknown as string,
      };
      const encrypted = encryptIntegrationData(data);
      expect(encrypted.accessToken).toBe("");
      expect(encrypted.refreshToken).toBeNull();
      expect(encrypted.webhookUrl).toBe(123);
    });
  });

  describe("decryptIntegrationData", () => {
    it("round-trips through encrypt and decrypt", async () => {
      const { encryptIntegrationData, decryptIntegrationData } = await loadModule();
      const original = {
        accessToken: "secret",
        refreshToken: "refresh-secret",
        webhookUrl: "https://hooks.example.com",
        guildId: "guild-123",
      };
      const encrypted = encryptIntegrationData(original);
      const decrypted = decryptIntegrationData(encrypted);
      expect(decrypted).toEqual(original);
    });

    it("handles plaintext values (graceful migration)", async () => {
      const { decryptIntegrationData } = await loadModule();
      const legacy = {
        accessToken: "plaintext-legacy-token",
        guildId: "guild-123",
      };
      const decrypted = decryptIntegrationData(legacy);
      expect(decrypted.accessToken).toBe("plaintext-legacy-token");
      expect(decrypted.guildId).toBe("guild-123");
    });
  });
});
