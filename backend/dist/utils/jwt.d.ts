interface TokenPayload {
    userId: string;
    role: string;
}
export declare const generateToken: (userId: string, role: string) => string;
export declare const verifyToken: (token: string) => TokenPayload;
export {};
