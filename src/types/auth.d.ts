import "better-auth";

declare module "better-auth" {
  interface User {
    role: string;
    member_type: string;
    first_name: string;
    last_name: string;
    nickname: string;
  }
}
