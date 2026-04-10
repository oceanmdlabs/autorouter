import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import type { ICryptoService } from "@/src/application/services/crypto.service.interface";
import {
  AppInitializationError,
  InvalidArgumentsError
} from "@/src/entities/errors/common";
import jwt from "jsonwebtoken";
import { createLoggerFromEnv, type Logger } from "@/src/entities/models/logger";


type Dependencies = {};


export const createCryptoService = (deps: Dependencies): ICryptoService => {
  const scryptAsync = promisify(scrypt);
  const key = process.env.ENCRYPTION_KEY;
  const jwtSecret = process.env.JWT_SECRET ?? key;
  const algorithm = "aes-256-gcm";

  const logger: Logger = createLoggerFromEnv();


  function getEncryptionKey(): Buffer {
    if (!key) {
      throw new AppInitializationError("ENCRYPTION_KEY is not set");
    }
    return Buffer.alloc(32, key.repeat(2), "utf8");
  }

  async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return salt + ":" + derivedKey.toString("hex");
  }

  async function comparePassword(
    candidatePassword: string,
    existingPasswordHash: string
  ): Promise<boolean> {
    const [salt, hash] = existingPasswordHash.split(":");
    if (!salt || !hash) {
      return false;
    }
    const derivedKey = (await scryptAsync(
      candidatePassword,
      salt,
      64
    )) as Buffer;
    return derivedKey.toString("hex") === hash;
  }

  function encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  function decrypt(ciphertext: string): string {

    if (!ciphertext || ciphertext === "") {
      logger.warn("Empty ciphertext provided to decrypt");
      return "";
    }
    const [ivHex, authTagHex, encryptedData] = ciphertext.split(":");
    if (!ivHex || !authTagHex || !encryptedData) {
      logger.debug("Incomplete ciphertext provided to decrypt");
      return "";
    }
    const iv = Buffer.from(ivHex ?? "", "hex");
    const authTag = Buffer.from(authTagHex ?? "", "hex");
    const decipher = createDecipheriv(algorithm, getEncryptionKey(), iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  function getJwtSecret(): string {
    if (!jwtSecret) {
      throw new AppInitializationError("JWT_SECRET is not set");
    }
    return jwtSecret as string;
  }

  function generateJWT(payload: Record<string, any>): string {
    return jwt.sign(payload, getJwtSecret(), {
      expiresIn: "1h",
      algorithm: "HS256"
    });
  }

  async function verifyJWT(token: string): Promise<Record<string, any>> {
    try {
      return jwt.verify(token, getJwtSecret()) as Record<string, any>;
    } catch (error) {
      throw createError({
        statusCode: 401,
        message: "Invalid or expired token"
      });
    }
  }

  return {
    hashPassword,
    comparePassword,
    encrypt,
    decrypt,
    generateJWT,
    verifyJWT
  };
};
