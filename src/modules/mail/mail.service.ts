import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const smtpUser = this.configService.get("SMTP_USER");
    const smtpPass = this.configService.get("SMTP_PASS");
    const smtpHost = this.configService.get("SMTP_HOST");
    const smtpPort = this.configService.get("SMTP_PORT");

    if (!smtpUser || !smtpPass || !smtpHost || !smtpPort) {
      console.error("SMTP credentials missing in .env file!");
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost || "smtp.gmail.com",
      port: parseInt(String(smtpPort)) || 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    console.log("Mail Service initialized");
  }

  // Premium email template wrapper
  private getEmailWrapper(content: string, footerText: string = ""): string {
    return `
<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bilimdon</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
          
          <!-- Logo Section -->
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <div style="display: inline-block; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 20px; padding: 15px 30px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 12px;">
                      <img src="http://localhost:3000/logo.png" alt="Bilimdon" width="45" height="45" style="display: block; border-radius: 10px;" />
                    </td>
                    <td style="vertical-align: middle;">
                      <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">
                        Bilimdon
                      </h1>
                      <p style="margin: 3px 0 0 0; font-size: 10px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px;">
                        BILIM PLATFORMASI
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #ffffff; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden;">
                
                <!-- Gradient Header Bar -->
                <tr>
                  <td style="height: 6px; background: linear-gradient(90deg, #667eea, #764ba2, #f093fb, #f5576c);"></td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 50px 40px;">
                    ${content}
                  </td>
                </tr>

                <!-- Footer inside card -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #e5e7eb; padding-top: 30px;">
                      <tr>
                        <td style="text-align: center;">
                          ${footerText ? `<p style="margin: 0 0 15px 0; font-size: 13px; color: #9ca3af;">${footerText}</p>` : ""}
                          <p style="margin: 0; font-size: 12px; color: #d1d5db;">
                            � ${new Date().getFullYear()} Bilimdon. Barcha huquqlar himoyalangan.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Bottom Links -->
          <tr>
            <td style="text-align: center; padding-top: 30px;">
              <p style="margin: 0 0 15px 0; font-size: 13px; color: rgba(255,255,255,0.7);">
                Savollaringiz bormi? Biz bilan bog'laning
              </p>
              <a href="https://t.me/bilimdonai_support" style="display: inline-block; padding: 10px 20px; background: rgba(255,255,255,0.2); color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600; margin: 0 5px;">
                <img src="https://cdn-icons-png.flaticon.com/24/2111/2111646.png" alt="Telegram" width="16" height="16" style="vertical-align: middle; margin-right: 6px;" />Telegram
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  async sendVerificationCode(email: string, code: string) {
    const smtpUser = this.configService.get("SMTP_USER");

    const codeDigits = code
      .split("")
      .map(
        (digit) => `
      <td style="width: 50px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; text-align: center; vertical-align: middle; margin: 0 4px;">
        <span style="font-size: 28px; font-weight: 800; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${digit}</span>
      </td>
    `
      )
      .join('<td style="width: 8px;"></td>');

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 20px; line-height: 80px; box-shadow: 0 10px 30px -5px rgba(16, 185, 129, 0.4);">
          <span style="font-size: 40px;">&#9989;</span>
        </div>
      </div>

      <!-- Title -->
      <h2 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 700; color: #1f2937; text-align: center; letter-spacing: -0.5px;">
        Email Tasdiqlash
      </h2>
      
      <p style="margin: 0 0 35px 0; font-size: 16px; color: #6b7280; text-align: center; line-height: 1.6;">
        Ro'yxatdan o'tishni yakunlash uchun quyidagi kodni kiriting
      </p>

      <!-- OTP Code -->
      <div style="text-align: center; margin-bottom: 35px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
          <tr>
            ${codeDigits}
          </tr>
        </table>
      </div>

      <!-- Timer Warning -->
      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; margin-bottom: 25px;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          &#9888; <strong>Diqqat!</strong> Bu kod <strong>10 daqiqa</strong> ichida amal qiladi
        </p>
      </div>

      <!-- Security Notice -->
      <div style="text-align: center; padding: 15px 20px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
          &#128274; Agar siz ro'yxatdan o'tmagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring
        </p>
      </div>
    `;

    const mailOptions = {
      from: "Bilimdon Platform <" + smtpUser + ">",
      to: email,
      subject: "&#9989; Email Tasdiqlash Kodi - Bilimdon",
      html: this.getEmailWrapper(
        content,
        "Bu avtomatik xabar. Iltimos, javob bermang."
      ),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Verification code sent to: " + email);
      return info;
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, fullName: string) {
    const smtpUser = this.configService.get("SMTP_USER");

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 100px; height: 100px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; line-height: 100px; box-shadow: 0 15px 35px -5px rgba(102, 126, 234, 0.4);">
          <span style="font-size: 50px;">&#127881;</span>
        </div>
      </div>

      <!-- Welcome Title -->
      <h2 style="margin: 0 0 10px 0; font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-align: center;">
        Xush kelibsiz!
      </h2>
      
      <p style="margin: 0 0 30px 0; font-size: 20px; color: #374151; text-align: center; font-weight: 600;">
        Salom, ${fullName}! &#128075;
      </p>

      <p style="margin: 0 0 35px 0; font-size: 16px; color: #6b7280; text-align: center; line-height: 1.8;">
        Siz <strong style="color: #667eea;">Bilimdon</strong> platformasiga muvaffaqiyatli ro'yxatdan o'tdingiz! 
        Endi siz minglab savollar va testlardan foydalanishingiz mumkin.
      </p>

      <!-- Features -->
      <div style="margin-bottom: 35px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding: 15px 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; margin-bottom: 10px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 45px; vertical-align: top;">
                    <span style="font-size: 24px;">&#9989;</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 15px; color: #166534; font-weight: 600;">1000+ Savollar</p>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #22c55e;">Turli fanlar bo'yicha</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 15px 20px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 45px; vertical-align: top;">
                    <span style="font-size: 24px;">&#9989;</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 15px; color: #1e40af; font-weight: 600;">Reyting tizimi</p>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #3b82f6;">Boshqalar bilan raqobatlashing</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 15px 20px; background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%); border-radius: 12px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 45px; vertical-align: top;">
                    <span style="font-size: 24px;">&#9989;</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 15px; color: #86198f; font-weight: 600;">Yutuqlar va mukofotlar</p>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #d946ef;">O'z maqsadlaringizga erishing</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="http://localhost:3000" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 14px; font-size: 16px; font-weight: 700; box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.5); letter-spacing: 0.5px;">
          &#128640; Platformaga kirish
        </a>
      </div>
    `;

    const mailOptions = {
      from: "Bilimdon Platform <" + smtpUser + ">",
      to: email,
      subject: "&#127881; Xush kelibsiz, " + fullName + "! - Bilimdon",
      html: this.getEmailWrapper(content),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Welcome email sent to: " + email);
      return info;
    } catch (error) {
      console.error("Error sending welcome email:", error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, code: string, fullName: string) {
    const smtpUser = this.configService.get("SMTP_USER");

    const codeDigits = code
      .split("")
      .map(
        (digit) => `
      <td style="width: 50px; height: 60px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 12px; text-align: center; vertical-align: middle;">
        <span style="font-size: 28px; font-weight: 800; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${digit}</span>
      </td>
    `
      )
      .join('<td style="width: 8px;"></td>');

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 20px; line-height: 80px; border: 2px solid #fecaca;">
          <span style="font-size: 40px;">&#128274;</span>
        </div>
      </div>

      <!-- Title -->
      <h2 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 700; color: #1f2937; text-align: center; letter-spacing: -0.5px;">
        Parolni Tiklash
      </h2>
      
      <p style="margin: 0 0 10px 0; font-size: 18px; color: #374151; text-align: center;">
        Salom, <strong>${fullName}</strong>! &#128075;
      </p>

      <p style="margin: 0 0 35px 0; font-size: 16px; color: #6b7280; text-align: center; line-height: 1.6;">
        Parolingizni tiklash uchun quyidagi kodni kiriting
      </p>

      <!-- OTP Code -->
      <div style="text-align: center; margin-bottom: 35px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
          <tr>
            ${codeDigits}
          </tr>
        </table>
      </div>

      <!-- Timer Warning -->
      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; margin-bottom: 25px; border: 1px solid #fecaca;">
        <p style="margin: 0; font-size: 14px; color: #991b1b;">
          ?? <strong>Diqqat!</strong> Bu kod <strong>10 daqiqa</strong> ichida amal qiladi
        </p>
      </div>

      <!-- Security Notice -->
      <div style="text-align: center; padding: 20px; background: #fffbeb; border-radius: 12px; border: 1px solid #fde68a;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e; font-weight: 600;">
          &#128274; Xavfsizlik haqida
        </p>
        <p style="margin: 0; font-size: 13px; color: #a16207; line-height: 1.5;">
          Agar siz parolni tiklamagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring. 
          Sizning hisobingiz xavfsiz.
        </p>
      </div>
    `;

    const mailOptions = {
      from: "Bilimdon Platform <" + smtpUser + ">",
      to: email,
      subject: "&#128274; Parolni Tiklash Kodi - Bilimdon",
      html: this.getEmailWrapper(
        content,
        "Bu avtomatik xabar. Iltimos, javob bermang."
      ),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Password reset email sent to: " + email);
      return info;
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  }

  // New: Send notification email
  async sendNotificationEmail(
    email: string,
    title: string,
    message: string,
    fullName?: string
  ) {
    const smtpUser = this.configService.get("SMTP_USER");

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 20px; line-height: 80px; box-shadow: 0 10px 30px -5px rgba(139, 92, 246, 0.4);">
          <span style="font-size: 40px;">&#128274;</span>
        </div>
      </div>

      <!-- Title -->
      <h2 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 700; color: #1f2937; text-align: center; letter-spacing: -0.5px;">
        ${title}
      </h2>
      
      ${
        fullName
          ? `
      <p style="margin: 0 0 25px 0; font-size: 16px; color: #6b7280; text-align: center;">
        Salom, <strong style="color: #8b5cf6;">${fullName}</strong>! &#128075;
      </p>
      `
          : ""
      }

      <!-- Message Box -->
      <div style="padding: 25px; background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border-radius: 16px; border-left: 4px solid #8b5cf6; margin-bottom: 30px;">
        <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.8;">
          ${message}
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="http://localhost:3000" style="display: inline-block; padding: 14px 35px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 600; box-shadow: 0 8px 20px -5px rgba(139, 92, 246, 0.4);">
          &#128640; Ilovaga o'tish
        </a>
      </div>
    `;

    const mailOptions = {
      from: "Bilimdon Platform <" + smtpUser + ">",
      to: email,
      subject: "?? " + title + " - Bilimdon",
      html: this.getEmailWrapper(content),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Notification email sent to: " + email);
      return info;
    } catch (error) {
      console.error("Error sending notification email:", error);
      throw error;
    }
  }

  // New: Send achievement unlocked email
  async sendAchievementEmail(
    email: string,
    fullName: string,
    achievementName: string,
    achievementIcon: string,
    xpReward: number
  ) {
    const smtpUser = this.configService.get("SMTP_USER");

    const content = `
      <!-- Confetti Effect Header -->
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 40px;">&#128274;</span>
        <span style="font-size: 50px;">&#127881;</span>
        <span style="font-size: 40px;">&#128274;</span>
      </div>

      <!-- Title -->
      <h2 style="margin: 0 0 10px 0; font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #f59e0b, #eab308); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-align: center;">
        Yutuq Ochildi!
      </h2>
      
      <p style="margin: 0 0 30px 0; font-size: 18px; color: #374151; text-align: center;">
        Tabriklaymiz, <strong>${fullName}</strong>! ??
      </p>

      <!-- Achievement Card -->
      <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-radius: 20px; border: 2px solid #fde047; margin-bottom: 30px; box-shadow: 0 10px 30px -10px rgba(234, 179, 8, 0.3);">
        <div style="font-size: 60px; margin-bottom: 15px;">${achievementIcon}</div>
        <h3 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 700; color: #854d0e;">
          ${achievementName}
        </h3>
        <div style="display: inline-block; padding: 8px 20px; background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); border-radius: 30px;">
          <span style="font-size: 16px; font-weight: 700; color: #ffffff;">+${xpReward} XP</span>
        </div>
      </div>

      <!-- Motivational Text -->
      <p style="margin: 0 0 30px 0; font-size: 16px; color: #6b7280; text-align: center; line-height: 1.6;">
        Siz ajoyib natijaga erishdingiz! Davom eting va yangi yutuqlarni oching! ??
      </p>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="http://localhost:3000/achievements" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); color: #ffffff; text-decoration: none; border-radius: 14px; font-size: 16px; font-weight: 700; box-shadow: 0 10px 25px -5px rgba(245, 158, 11, 0.5);">
          ?? Barcha yutuqlarim
        </a>
      </div>
    `;

    const mailOptions = {
      from: "Bilimdon Platform <" + smtpUser + ">",
      to: email,
      subject: "?? Yangi yutuq: " + achievementName + " - Bilimdon",
      html: this.getEmailWrapper(content),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Achievement email sent to: " + email);
      return info;
    } catch (error) {
      console.error("Error sending achievement email:", error);
      throw error;
    }
  }

  // Send invite email for non-registered users
  async sendInviteEmail(email: string) {
    const smtpUser = this.configService.get("SMTP_USER");

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 90px; height: 90px; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); border-radius: 24px; line-height: 90px; box-shadow: 0 15px 35px -5px rgba(6, 182, 212, 0.4);">
          <span style="font-size: 45px;">??</span>
        </div>
      </div>

      <!-- Title -->
      <h2 style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; background: linear-gradient(135deg, #06b6d4, #0891b2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-align: center;">
        Sizni taklif qilamiz!
      </h2>
      
      <p style="margin: 0 0 30px 0; font-size: 17px; color: #374151; text-align: center; line-height: 1.7;">
        Salom! Siz <strong style="color: #06b6d4;">Bilimdon</strong> platformasiga ro'yxatdan o'tmagansiz. 
        Ro'yxatdan o'ting va <strong>1000+</strong> savollar bilan bilimingizni sinab ko'ring!
      </p>

      <!-- Features Box -->
      <div style="padding: 25px; background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%); border-radius: 20px; margin-bottom: 30px; border: 1px solid #a5f3fc;">
        <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #0e7490; text-align: center;">
          ? Bilimdon sizga nima beradi?
        </h3>
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding: 10px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 35px; vertical-align: middle;">
                    <span style="font-size: 22px;">??</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 15px; color: #155e75;">Turli fanlar bo'yicha <strong>1000+</strong> savollar</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 35px; vertical-align: middle;">
                    <span style="font-size: 22px;">??</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 15px; color: #155e75;">Reyting tizimi va boshqalar bilan raqobat</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 35px; vertical-align: middle;">
                    <span style="font-size: 22px;">??</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 15px; color: #155e75;">Yutuqlar va mukofotlar tizimi</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 35px; vertical-align: middle;">
                    <span style="font-size: 22px;">??</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 15px; color: #155e75;">AI yordamchi bilan savollaringizga javob</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 25px;">
        <a href="http://localhost:3000/auth/register" style="display: inline-block; padding: 18px 50px; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #ffffff; text-decoration: none; border-radius: 16px; font-size: 18px; font-weight: 700; box-shadow: 0 12px 30px -5px rgba(6, 182, 212, 0.5); letter-spacing: 0.5px;">
          ?? Hoziroq ro'yxatdan o'ting!
        </a>
      </div>

      <!-- Bonus Text -->
      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-radius: 12px; border: 1px solid #fde047;">
        <p style="margin: 0; font-size: 15px; color: #854d0e;">
          ?? <strong>Bonus:</strong> Ro'yxatdan o'tganingizda <strong style="color: #ca8a04;">+50 XP</strong> sovg'a!
        </p>
      </div>
    `;

    const mailOptions = {
      from: "Bilimdon Platform <" + smtpUser + ">",
      to: email,
      subject: "?? Bilimdon platformasiga taklif - Bepul ro'yxatdan o'ting!",
      html: this.getEmailWrapper(content),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Invite email sent to: " + email);
      return info;
    } catch (error) {
      console.error("Error sending invite email:", error);
      throw error;
    }
  }

  // Send login attempt warning for other registered users
  async sendLoginAttemptWarning(email: string, fullName: string) {
    const smtpUser = this.configService.get("SMTP_USER");

    const content = `
      <!-- Icon -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 90px; height: 90px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 24px; line-height: 90px; box-shadow: 0 15px 35px -5px rgba(245, 158, 11, 0.4);">
          <span style="font-size: 45px;">??</span>
        </div>
      </div>

      <!-- Title -->
      <h2 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-align: center;">
        Profilingizga kirish urinishi!
      </h2>
      
      <p style="margin: 0 0 25px 0; font-size: 17px; color: #374151; text-align: center; line-height: 1.7;">
        Salom, <strong style="color: #f59e0b;">${fullName || "Foydalanuvchi"}</strong>! 
        Kimdir sizning email manzilingiz orqali parolni tiklashga harakat qildi.
      </p>

      <!-- Warning Box -->
      <div style="padding: 25px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 20px; margin-bottom: 25px; border: 2px solid #f59e0b;">
        <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #92400e; text-align: center;">
          &#128274; Xavfsizlik eslatmasi
        </h3>
        <p style="margin: 0; font-size: 15px; color: #78350f; text-align: center; line-height: 1.6;">
          Agar bu siz bo'lsangiz, quyidagi tugmani bosib profilingizga kiring. 
          Agar bu siz bo'lmasangiz, bu xabarni e'tiborsiz qoldiring.
        </p>
      </div>

      <!-- Info Box -->
      <div style="padding: 20px; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 16px; margin-bottom: 25px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 30px; vertical-align: middle;">
                    <span style="font-size: 18px;">??</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Email: <strong style="color: #374151;">${email}</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 30px; vertical-align: middle;">
                    <span style="font-size: 18px;">??</span>
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Vaqt: <strong style="color: #374151;">${new Date().toLocaleString("uz-UZ")}</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 25px;">
        <a href="http://localhost:3000/auth/login" style="display: inline-block; padding: 18px 50px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 16px; font-size: 18px; font-weight: 700; box-shadow: 0 12px 30px -5px rgba(245, 158, 11, 0.5); letter-spacing: 0.5px;">
          ?? Profilga kirish
        </a>
      </div>

      <!-- Security Tips -->
      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border: 1px solid #6ee7b7;">
        <p style="margin: 0; font-size: 14px; color: #065f46;">
          ?? <strong>Maslahat:</strong> Parolingizni xavfsiz saqlang va hech kim bilan ulashmang!
        </p>
      </div>
    `;

    const mailOptions = {
      from: "Bilimdon Platform <" + smtpUser + ">",
      to: email,
      subject: "?? Bilimdon - Profilingizga kirish urinishi aniqlandi",
      html: this.getEmailWrapper(content),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Login attempt warning sent to: " + email);
      return info;
    } catch (error) {
      console.error("Error sending login attempt warning:", error);
      throw error;
    }
  }

  // Admin xabari yuborish
  async sendAdminMessage(
    email: string,
    title: string,
    message: string,
    adminName?: string,
    imageUrl?: string,
    videoUrl?: string
  ) {
    const smtpUser = this.configService.get("SMTP_USER");
    // Production URL - uploads fayllari shu yerda
    const baseUrl =
      this.configService.get("BACKEND_URL") || "http://localhost:3001";

    // Rasm URL'ni to'liq qilish
    let fullImageUrl: string | null = null;
    let localImagePath: string | null = null;
    if (imageUrl) {
      if (imageUrl.startsWith("http")) {
        fullImageUrl = imageUrl;
      } else {
        fullImageUrl = `${baseUrl}${imageUrl}`;
        // Local path uchun
        localImagePath = require("path").join(process.cwd(), imageUrl);
      }
      console.log("[Mail] Image URL:", fullImageUrl);
      console.log("[Mail] Local image path:", localImagePath);
    }

    // Video URL'ni to'liq qilish
    let fullVideoUrl: string | null = null;
    if (videoUrl) {
      if (videoUrl.startsWith("http")) {
        fullVideoUrl = videoUrl;
      } else {
        fullVideoUrl = `${baseUrl}${videoUrl}`;
      }
      console.log("[Mail] Video URL:", fullVideoUrl);
    }

    // Media qismi - rasm yoki video
    let mediaSection = "";
    const attachments: any[] = [];

    if (fullImageUrl) {
      // Rasmni CID orqali embed qilamiz
      const imageCid = "embedded-image-" + Date.now();

      if (localImagePath && require("fs").existsSync(localImagePath)) {
        // Local file mavjud - CID attachment sifatida qo'shamiz
        attachments.push({
          filename: "image.jpg",
          path: localImagePath,
          cid: imageCid,
        });
        mediaSection = `
          <div style="margin: 20px 0; text-align: center;">
            <img src="cid:${imageCid}" alt="Xabar rasmi" style="max-width: 100%; width: 100%; height: auto; border-radius: 12px; display: block;" />
          </div>
        `;
      } else {
        // Tashqi URL - oddiy img tag
        mediaSection = `
          <div style="margin: 20px 0; text-align: center;">
            <a href="${fullImageUrl}" target="_blank" style="display: inline-block; width: 100%;">
              <img src="${fullImageUrl}" alt="Xabar rasmi" style="max-width: 100%; width: 100%; height: auto; border-radius: 12px; display: block;" />
            </a>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">
              Rasm ko'rinmasa, <a href="${fullImageUrl}" target="_blank" style="color: #6366f1;">bu yerga bosing</a>
            </p>
          </div>
        `;
      }
    }

    if (fullVideoUrl) {
      // Video uchun chiroyli preview - play icon bilan
      mediaSection = `
        <div style="margin: 20px 0; text-align: center;">
          <a href="${fullVideoUrl}" target="_blank" style="display: block; text-decoration: none;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2d1b69 100%); border-radius: 16px; overflow: hidden;">
              <tr>
                <td style="padding: 40px 30px; text-align: center;">
                  <!-- Play button circle -->
                  <div style="display: inline-block; width: 80px; height: 80px; background: rgba(255,255,255,0.15); border-radius: 50%; line-height: 80px; margin-bottom: 20px; border: 3px solid rgba(255,255,255,0.3);">
                    <span style="font-size: 36px; color: #ffffff; margin-left: 5px;">&#9658;</span>
                  </div>
                  <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 18px; font-weight: 600;">Video xabar</p>
                  <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.7); font-size: 13px;">Ko'rish uchun bosing</p>
                  <span style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; border-radius: 25px; font-size: 14px; font-weight: 600;">
                    &#127909; Videoni ochish
                  </span>
                </td>
              </tr>
            </table>
          </a>
        </div>
      `;
    }

    const content = `
      <!-- Title -->
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #1f2937; text-align: center;">
        ${title}
      </h1>
      
      <p style="margin: 0 0 25px 0; font-size: 14px; color: #6b7280; text-align: center;">
        Bilimdon administratoridan xabar
      </p>

      <!-- Message Box -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px 25px; background-color: #f3f4f6; border-radius: 12px; border-left: 4px solid #6366f1;">
            <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.7;">
              ${message}
            </p>
          </td>
        </tr>
      </table>

      ${mediaSection}

      ${
        adminName
          ? `
      <p style="margin: 20px 0; font-size: 13px; color: #9ca3af; text-align: right;">
        — ${adminName}, Bilimdon Admin
      </p>
      `
          : ""
      }

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 25px;">
        <a href="http://localhost:3000" style="display: inline-block; padding: 14px 35px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 600;">
          &#127891; Bilimdon'ga o'tish
        </a>
      </div>
    `;

    const mailOptions: any = {
      from: "Bilimdon Platform <" + smtpUser + ">",
      to: email,
      subject: `${title} - Bilimdon`,
      html: this.getEmailWrapper(content),
    };

    // Agar attachment bo'lsa, qo'shamiz
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Admin message sent to: " + email);
      return info;
    } catch (error) {
      console.error("Error sending admin message:", error);
      throw error;
    }
  }
}
