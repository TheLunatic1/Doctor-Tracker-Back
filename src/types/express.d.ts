import { IUser } from '../models/User.js';
import { TokenPayload } from '../services/token.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      tokenPayload?: TokenPayload;
    }
  }
}

export {};
