import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Role } from "../../users/entities/user.entity";

/**
 * Guard that allows only ADMIN role to perform write operations (POST, PATCH, DELETE).
 * MODERATOR can only view (GET requests).
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;

    // Allow ADMIN to do anything
    if (user?.role === Role.ADMIN) {
      return true;
    }

    // MODERATOR can only use GET methods
    if (user?.role === Role.MODERATOR) {
      if (method === "GET") {
        return true;
      }
      throw new ForbiddenException(
        "Moderatorlar faqat ma'lumotlarni ko'rishlari mumkin",
      );
    }

    // Other roles - deny access
    throw new ForbiddenException("Bu amaliyot uchun admin huquqi kerak");
  }
}
