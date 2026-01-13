import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class UploadService {
  private uploadDir: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];

  constructor(private configService: ConfigService, private prisma: PrismaService) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || './uploads';
    this.maxFileSize = 50 * 1024 * 1024;
    this.allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    const dirs = ['avatars', 'attachments', 'temp'];
    dirs.forEach(dir => {
      const fullPath = path.join(this.uploadDir, dir);
      if (!fs.existsSync(fullPath)) { fs.mkdirSync(fullPath, { recursive: true }); }
    });
  }

  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<{ url: string; user: any }> {
    this.validateFile(file);
    const currentUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = userId + '-' + Date.now() + ext;
    const filepath = path.join(this.uploadDir, 'avatars', filename);
    await fs.promises.writeFile(filepath, file.buffer);
    const url = '/uploads/avatars/' + filename;
    const updatedUser = await this.prisma.user.update({ where: { id: userId }, data: { avatar: url }, select: { id: true, email: true, username: true, fullName: true, avatar: true, bio: true, totalXP: true, level: true, role: true, telegramId: true, createdAt: true } });
    if (currentUser?.avatar?.startsWith('/uploads/avatars/')) {
      const oldFilename = currentUser.avatar.replace('/uploads/avatars/', '');
      const oldFilepath = path.join(this.uploadDir, 'avatars', oldFilename);
      try { if (fs.existsSync(oldFilepath)) { await fs.promises.unlink(oldFilepath); } } catch (e) {}
    }
    return { url, user: updatedUser };
  }

  async uploadAttachment(file: Express.Multer.File): Promise<{ url: string; filename: string; size: number; mimetype: string }> {
    console.log('[Upload Service] uploadAttachment called');
    this.validateAttachment(file);
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const filename = uniqueId + '-' + Date.now() + ext;
    const filepath = path.join(this.uploadDir, 'attachments', filename);
    await fs.promises.writeFile(filepath, file.buffer);
    const url = '/uploads/attachments/' + filename;
    return { url, filename: file.originalname, size: file.size, mimetype: file.mimetype };
  }

  getFilePath(filename: string, type: 'avatars' | 'attachments' = 'attachments'): string {
    return path.join(this.uploadDir, type, filename);
  }

  /**
   * Download avatar from URL (e.g., Telegram) and save locally
   * Returns local URL path or null if failed
   */
  async downloadAndSaveAvatar(imageUrl: string, uniqueId: string): Promise<string | null> {
    try {
      console.log('[UploadService] Downloading avatar from:', imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error('[UploadService] Failed to download avatar:', response.status);
        return null;
      }
      
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('png') ? '.png' : contentType.includes('gif') ? '.gif' : '.jpg';
      const filename = `tg-${uniqueId}-${Date.now()}${ext}`;
      const filepath = path.join(this.uploadDir, 'avatars', filename);
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      if (buffer.length < 100) {
        console.error('[UploadService] Avatar buffer too small, skipping');
        return null;
      }
      
      await fs.promises.writeFile(filepath, buffer);
      const localUrl = '/uploads/avatars/' + filename;
      console.log('[UploadService] Avatar saved locally:', localUrl);
      return localUrl;
    } catch (error) {
      console.error('[UploadService] Error downloading avatar:', error);
      return null;
    }
  }

  async deleteFile(filepath: string): Promise<void> {
    const fullPath = path.join(process.cwd(), filepath);
    try { if (fs.existsSync(fullPath)) { await fs.promises.unlink(fullPath); } } catch (e) {}
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) { throw new BadRequestException('Fayl yuklanmadi'); }
    if (file.size > this.maxFileSize) { throw new BadRequestException('Fayl hajmi 50MB dan oshmasligi kerek'); }
    if (!this.allowedMimeTypes.includes(file.mimetype)) { throw new BadRequestException('Faqat rasm fayllarini yuklash mumkin'); }
  }

  private validateAttachment(file: Express.Multer.File) {
    if (!file) { throw new BadRequestException('Fayl yuklanmadi'); }
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) { throw new BadRequestException('Fayl hajmi 50MB dan oshmasligi kerak'); }
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp', '.tiff', '.tif',
      // Videos
      '.mp4', '.webm', '.mov', '.avi', '.mpeg', '.mpg', '.mkv', '.3gp', '.wmv', '.flv',
      // Documents (optional)
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'
    ];
    if (!allowedExtensions.includes(ext)) { throw new BadRequestException('Fayl formati qollab-quvvatlanmaydi'); }
    if (!file.buffer || file.buffer.length === 0) { throw new BadRequestException('Fayl buffer bosh'); }
  }
}
