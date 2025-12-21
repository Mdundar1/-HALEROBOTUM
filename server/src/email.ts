import nodemailer from 'nodemailer';

// SMTP Configuration from environment variables
const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
};

const FROM_EMAIL = process.env.FROM_EMAIL || 'İhale Robotum <noreply@ihalerobotum.com>';

// Create reusable transporter
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// Verify connection configuration
transporter.verify((error: Error | null, success: boolean) => {
    if (error) {
        console.warn('⚠️  SMTP connection failed:', error.message);
        console.warn('Email verification will not work until SMTP is configured in .env');
    } else {
        console.log('✓ SMTP server is ready to send emails');
    }
});

/**
 * Send verification code email
 */
export const sendVerificationEmail = async (email: string, code: string): Promise<boolean> => {
    try {
        const mailOptions = {
            from: FROM_EMAIL,
            to: email,
            subject: 'Email Doğrulama Kodu - İhale Robotum',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                 color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
                        .code-box { background: white; border: 2px dashed #667eea; 
                                   padding: 20px; margin: 20px 0; text-align: center; 
                                   border-radius: 8px; }
                        .code { font-size: 32px; font-weight: bold; color: #667eea; 
                              letter-spacing: 8px; font-family: monospace; }
                        .footer { text-align: center; color: #64748b; font-size: 12px; 
                                margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
                        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; 
                                 padding: 12px; margin: 15px 0; border-radius: 4px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0;">İhale Robotum</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Email Doğrulama</p>
                        </div>
                        <div class="content">
                            <h2 style="color: #1e293b;">Merhaba!</h2>
                            <p>İhale Robotum'a kaydolduğunuz için teşekkür ederiz. Email adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
                            
                            <div class="code-box">
                                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Doğrulama Kodunuz</p>
                                <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0f172a; margin: 10px 0;">
                                    ${code}
                                </div>
                                <strong>⏱️ Önemli:</strong> Bu kod <strong>15 dakika</strong> geçerlidir.
                            </div>

                            <p>Kodu web sayfasındaki doğrulama alanına girerek hesabınızı aktifleştirebilirsiniz.</p>
                            
                            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                                <strong>Not:</strong> Eğer bu kaydı siz yapmadıysanız, bu e-postayı güvenle yoksayabilirsiniz.
                            </p>
                        </div>
                        <div class="footer">
                            <p>Bu otomatik bir e-postadır, lütfen yanıtlamayın.</p>
                            <p>&copy; 2025 İhale Robotum. Tüm hakları saklıdır.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
İhale Robotum - Email Doğrulama

Merhaba!

İhale Robotum'a kaydolduğunuz için teşekkür ederiz.

Doğrulama Kodunuz: ${code}

Bu kod 15 dakika geçerlidir.

Kodu web sayfasındaki doğrulama alanına girerek hesabınızı aktifleştirebilirsiniz.

Not: Eğer bu kaydı siz yapmadıysanız, bu e-postayı güvenle yoksayabilirsiniz.

---
İhale Robotum
Bu otomatik bir e-postadır.
            `.trim()
        };

        await transporter.sendMail(mailOptions);
        console.log(`✓ Verification email sent to ${email}`);
        return true;
    } catch (error: any) {
        console.error('Failed to send verification email:', error.message);
        return false;
    }
};

/**
 * Generate 6-digit verification code
 */
export const generateVerificationCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export default { sendVerificationEmail, generateVerificationCode };
