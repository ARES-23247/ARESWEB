import "better-auth";

declare module "better-auth" {
  interface User {
    role: string;
    memberType: string;
    firstName: string;
    lastName: string;
    nickname: string;
  }
}

