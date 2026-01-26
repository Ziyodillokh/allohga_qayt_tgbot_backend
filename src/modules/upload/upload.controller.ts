import {
  Controller,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Param,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { UploadService } from "./upload.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities";
import * as fs from "fs";
import * as path from "path";
import { memoryStorage } from "multer";

@ApiTags("Upload")
@ApiBearerAuth()
@Controller("upload")
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post("avatar")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload user avatar" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    console.log("[Upload Controller] ========== AVATAR UPLOAD ==========");
    console.log("[Upload Controller] User ID:", req.user?.id);
    console.log("[Upload Controller] File:", file?.originalname);

    // 1. Faylni saqlash
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${req.user.id}-${Date.now()}${ext}`;
    const uploadDir = "./uploads/avatars";
    const filepath = path.join(uploadDir, filename);

    // Papka mavjudligini tekshirish
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await fs.promises.writeFile(filepath, file.buffer);
    console.log("[Upload Controller] File saved:", filepath);

    const avatarUrl = `/uploads/avatars/${filename}`;

    // 2. Database'ni yangilash - TypeORM BILAN
    console.log("[Upload Controller] Updating database with URL:", avatarUrl);
    await this.userRepository.update(req.user.id, { avatar: avatarUrl });
    const updatedUser = await this.userRepository.findOne({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        bio: true,
        totalXP: true,
        level: true,
        role: true,
        telegramId: true,
        createdAt: true,
      },
    });
    console.log(
      "[Upload Controller] Database updated! Avatar:",
      updatedUser?.avatar,
    );

    return { url: avatarUrl, user: updatedUser };
  }

  @Post("attachment")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit for videos
      },
    }),
  )
  @ApiOperation({ summary: "Upload attachment (images/videos)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    console.log("[Upload Controller] Attachment upload request received");
    console.log(
      "[Upload Controller] File:",
      file ? file.originalname : "NO FILE",
    );
    console.log("[Upload Controller] File size:", file?.size);
    console.log("[Upload Controller] Buffer length:", file?.buffer?.length);

    try {
      const result = await this.uploadService.uploadAttachment(file);
      console.log("[Upload Controller] Upload success:", result);
      return result; // Return the full result object with url, filename, size, mimetype
    } catch (error: any) {
      console.error(
        "[Upload Controller] Upload error:",
        error?.message || error,
      );
      throw error;
    }
  }

  @Delete(":filename")
  @ApiOperation({ summary: "Delete uploaded file" })
  async deleteFile(@Param("filename") filename: string) {
    await this.uploadService.deleteFile(filename);
    return { message: "Fayl o'chirildi" };
  }
}
