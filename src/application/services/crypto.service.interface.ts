export interface ICryptoService {
  hashPassword(password: string): Promise<string>;
  comparePassword(
    candidatePassword: string,
    existingPasswordHash: string
  ): Promise<boolean>;
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
  generateJWT(payload: Record<string, any>): string;
  verifyJWT(token: string): Promise<Record<string, any>>;
}
