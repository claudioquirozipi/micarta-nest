export class UserEntity {
  id: string;
  email: string;
  name: string | null;
  googleId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
