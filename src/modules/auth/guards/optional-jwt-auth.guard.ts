import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) {
    // Check if there's an authorization header
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // If no auth header, allow request to proceed without authentication
    if (!authHeader) {
      return true;
    }

    // Try to authenticate
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // If there's an error or no user, just return null instead of throwing
    // This allows the request to proceed without authentication
    if (err || !user) {
      return null;
    }
    return user;
  }
}
